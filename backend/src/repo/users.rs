use sqlx::{FromRow, Postgres, Transaction};
use time::{Duration, OffsetDateTime};
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct WalletRow {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub created_wallet: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum LeaderboardPeriod {
    AllTime,
    Monthly, // last 30 days
    Weekly,  // last 7 days
}

#[derive(Debug)]
pub struct LeaderboardUser {
    pub rank: i64,
    pub prev_rank: Option<i64>,
    pub address: String,
    pub win_rate: f64,
    pub total_bets: i64,
    pub volume: f64,
    pub streak: i64,
    pub level: String,
    pub points: i64,
    pub change: String,
}

pub async fn upsert_wallet(
    pool: &sqlx::PgPool,
    wallet: &str,
    now: OffsetDateTime,
) -> anyhow::Result<(Uuid, Uuid, bool)> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    if let Some(rec) = sqlx::query_as::<_, WalletRow>(
        r#"
        UPDATE wallets
           SET last_login_at = $2,
               login_count   = login_count + 1
         WHERE wallet_address = $1
         RETURNING id, user_id, false AS created_wallet
        "#
    )
    .bind(wallet)
    .bind(now)
    .fetch_optional(&mut *tx)
    .await?
    {
        tx.commit().await?;
        return Ok((rec.user_id, rec.id, false));
    }

    let new_user_id: Uuid = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users DEFAULT VALUES RETURNING id"
    )
    .fetch_one(&mut *tx)
    .await?;

    let rec = sqlx::query_as::<_, WalletRow>(
        r#"
        INSERT INTO wallets (user_id, wallet_address, last_login_at, login_count)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (wallet_address) DO UPDATE
          SET last_login_at = EXCLUDED.last_login_at,
              login_count   = wallets.login_count + 1
        RETURNING id, user_id, (xmax = 0) AS created_wallet
        "#
    )
    .bind(new_user_id)
    .bind(wallet)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    if !rec.created_wallet {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(new_user_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok((rec.user_id, rec.id, rec.created_wallet))
}

pub async fn exists_user_wallet(
    pool: &sqlx::PgPool,
    user_id: &str,
    wallet_id: &str,
    address: &str,
) -> sqlx::Result<bool> {
    let row: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM wallets w
          JOIN users u ON u.id = w.user_id
          WHERE u.id = $1::uuid
            AND w.id = $2::uuid
            AND w.wallet_address = $3
        )
        "#,
    )
    .bind(user_id)
    .bind(wallet_id)
    .bind(address)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

pub async fn fetch_leaderboard_users(
    pool: &PgPool,
    period: LeaderboardPeriod,
    now: OffsetDateTime,
    limit: i64,
) -> Result<Vec<LeaderboardUser>> {
    let (start_ts, end_ts, prev_start_ts, prev_end_ts) = match period {
        LeaderboardPeriod::AllTime => (None, None, None, None),
        LeaderboardPeriod::Monthly => {
            let start = now - Duration::days(30);
            let prev_end = start;
            let prev_start = prev_end - Duration::days(30);
            (Some(start), Some(now), Some(prev_start), Some(prev_end))
        }
        LeaderboardPeriod::Weekly => {
            let start = now - Duration::days(7);
            let prev_end = start;
            let prev_start = prev_end - Duration::days(7);
            (Some(start), Some(now), Some(prev_start), Some(prev_end))
        }
    };

    let rows = sqlx::query!(
        r#"
            WITH params AS (
            SELECT
                $1::timestamptz  AS start_ts,
                $2::timestamptz  AS end_ts,
                $3::timestamptz  AS prev_start_ts,
                $4::timestamptz  AS prev_end_ts
            ),
            curr AS (
            SELECT
                w.wallet_address                       AS address,
                COUNT(b.id)::bigint                    AS total_bets,
                COALESCE(SUM(b.amount_1e6), 0)::bigint AS volume_1e6,
                SUM(
                CASE
                    WHEN ms.settled
                    AND (
                        (ms.winning_side = 1 AND b.side = 'yes') OR
                        (ms.winning_side = 2 AND b.side = 'no')
                    )
                    THEN 1 ELSE 0
                END
                )::bigint AS wins,
                w.points_total::bigint                 AS points_total,
                CASE
                WHEN w.points_total >= 15000 THEN 'Singularity'
                WHEN w.points_total >= 10000 THEN 'Oracle'
                WHEN w.points_total >=  5000 THEN 'Prophet'
                WHEN w.points_total >=  1000 THEN 'Forecaster'
                ELSE 'Observer'
                END AS level
            FROM wallets w
            JOIN market_bets b   ON b.user_pubkey = w.wallet_address
            JOIN markets m       ON m.id = b.market_id
            JOIN market_state ms ON ms.market_id = m.id
            CROSS JOIN params p
            WHERE (p.start_ts IS NULL OR b.created_at >= p.start_ts)
                AND (p.end_ts   IS NULL OR b.created_at <  p.end_ts)
            GROUP BY w.wallet_address, w.points_total
            ),
            ranked AS (
            SELECT
                address,
                total_bets,
                volume_1e6,
                wins,
                points_total,
                level,
                CASE
                WHEN total_bets = 0 THEN 0::float8
                ELSE ROUND((wins::numeric / total_bets::numeric) * 100.0, 1)::float8
                END AS win_rate,
                ROW_NUMBER() OVER (
                ORDER BY points_total DESC,
                        (CASE WHEN total_bets = 0 THEN 0 ELSE (wins::numeric / total_bets::numeric) END) DESC,
                        volume_1e6 DESC,
                        address ASC
                )::bigint AS rnk
            FROM curr
            ),
            prev_raw AS (
            SELECT
                w.wallet_address AS address,
                COUNT(b.id)::bigint                    AS total_bets,
                COALESCE(SUM(b.amount_1e6), 0)::bigint AS volume_1e6,
                SUM(
                CASE
                    WHEN ms.settled
                    AND (
                        (ms.winning_side = 1 AND b.side = 'yes') OR
                        (ms.winning_side = 2 AND b.side = 'no')
                    )
                    THEN 1 ELSE 0
                END
                )::bigint AS wins,
                w.points_total::bigint AS points_total
            FROM wallets w
            JOIN market_bets b   ON b.user_pubkey = w.wallet_address
            JOIN markets m       ON m.id = b.market_id
            JOIN market_state ms ON ms.market_id = m.id
            CROSS JOIN params p
            WHERE p.prev_start_ts IS NOT NULL
                AND b.created_at >= p.prev_start_ts
                AND b.created_at <  p.prev_end_ts
            GROUP BY w.wallet_address, w.points_total
            ),
            prev_ranked AS (
            SELECT
                address,
                ROW_NUMBER() OVER (
                ORDER BY points_total DESC,
                        (CASE WHEN total_bets = 0 THEN 0 ELSE (wins::numeric / total_bets::numeric) END) DESC,
                        volume_1e6 DESC,
                        address ASC
                )::bigint AS prev_rnk
            FROM prev_raw
            )
            SELECT
            COALESCE(r.rnk, 0)::bigint         AS rank,
            pr.prev_rnk                        AS prev_rank,
            COALESCE(r.address, '')            AS address,
            COALESCE(r.win_rate, 0::float8)    AS win_rate,
            COALESCE(r.total_bets, 0)::bigint  AS total_bets,
            COALESCE(r.volume_1e6, 0)::bigint  AS volume_1e6,
            COALESCE(r.level, 'Observer')      AS level,
            COALESCE(r.points_total, 0)::bigint AS points_total,
            COALESCE(
                CASE
                WHEN pr.prev_rnk IS NULL AND (SELECT prev_start_ts FROM params) IS NOT NULL THEN 'new'
                WHEN pr.prev_rnk IS NULL THEN 'same'
                WHEN pr.prev_rnk > r.rnk THEN 'up'
                WHEN pr.prev_rnk < r.rnk THEN 'down'
                ELSE 'same'
                END,
                'same'
            ) AS change
            FROM ranked r
            LEFT JOIN prev_ranked pr USING (address)
            ORDER BY r.rnk
            LIMIT $5
        "#,
        start_ts,
        end_ts,
        prev_start_ts,
        prev_end_ts,
        limit,
    )
    .fetch_all(pool)
    .await?;

    let out = rows
        .into_iter()
        .map(|row| LeaderboardUser {
            rank: row.rank.unwrap_or(0) as i64,
            prev_rank: row.prev_rank.map(|v| v as i64),
            address: row.address.unwrap_or_default(),
            win_rate: row.win_rate.unwrap_or(0.0),
            total_bets: row.total_bets.unwrap_or(0) as i64,
            volume: (row.volume_1e6.unwrap_or(0) as f64) / 1_000_000.0,
            streak: 0,
            level: row.level.unwrap_or_else(|| "Observer".to_string()),
            points: row.points_total.unwrap_or(0) as i64,
            change: row.change.unwrap_or_else(|| "same".to_string()),
        })
        .collect();

    Ok(out)
}