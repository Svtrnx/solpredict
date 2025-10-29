use anyhow::{Context, Result};
use sqlx::PgPool;
use sqlx::{FromRow, Postgres, Transaction};
use time::OffsetDateTime;
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
) -> Result<(Uuid, Uuid, bool)> {
    if wallet.is_empty() {
        return Err(anyhow::anyhow!("Wallet address cannot be empty"));
    }

    if wallet.len() < 32 || wallet.len() > 44 {
        return Err(anyhow::anyhow!("Invalid wallet address length"));
    }

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await
        .context("Failed to set transaction isolation level")?;

    let existing = sqlx::query_as::<_, WalletRow>(
        r#"
        UPDATE wallets
           SET last_login_at = $2,
               login_count   = login_count + 1
         WHERE wallet_address = $1
         RETURNING id, user_id, false AS created_wallet
        "#,
    )
    .bind(wallet)
    .bind(now)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(rec) = existing {
        tx.commit().await?;
        tracing::debug!(
            wallet = %wallet,
            user_id = %rec.user_id,
            "Existing wallet login"
        );
        return Ok((rec.user_id, rec.id, false));
    }

    let new_user_id: Uuid = sqlx::query_scalar("INSERT INTO users DEFAULT VALUES RETURNING id")
        .fetch_one(&mut *tx)
        .await?;

    let wallet_row = sqlx::query_as::<_, WalletRow>(
        r#"
        INSERT INTO wallets (user_id, wallet_address, last_login_at, login_count)
        VALUES ($1, $2, $3, 1)
        RETURNING id, user_id, true AS created_wallet
        "#,
    )
    .bind(new_user_id)
    .bind(wallet)
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .context("Failed to create wallet")?;

    tx.commit().await?;

    tracing::info!(
        wallet = %wallet,
        user_id = %new_user_id,
        "New wallet created"
    );

    Ok((wallet_row.user_id, wallet_row.id, true))
}

pub async fn exists_user_wallet(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    wallet_id: Uuid,
    address: &str,
) -> sqlx::Result<bool> {
    // Validate input
    if address.is_empty() {
        return Ok(false);
    }

    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM wallets w
          JOIN users u ON u.id = w.user_id
          WHERE u.id = $1
            AND w.id = $2
            AND w.wallet_address = $3
        ) AS "exists!"
        "#,
        user_id,
        wallet_id,
        address
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

pub async fn fetch_leaderboard_users(
    pool: &PgPool,
    period: LeaderboardPeriod,
    now: OffsetDateTime,
    limit: i64,
) -> Result<Vec<LeaderboardUser>> {
    let limit = limit.clamp(1, 100);
    let (start_ts, end_ts, prev_start_ts, prev_end_ts) = match period {
        LeaderboardPeriod::AllTime => (None, None, None, None),
        LeaderboardPeriod::Monthly => {
            let start = now - time::Duration::days(30);
            let prev_end = start;
            let prev_start = prev_end - time::Duration::days(30);
            (Some(start), Some(now), Some(prev_start), Some(prev_end))
        }
        LeaderboardPeriod::Weekly => {
            let start = now - time::Duration::days(7);
            let prev_end = start;
            let prev_start = prev_end - time::Duration::days(7);
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
          )::bigint AS wins_bets_based,
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

      wr_all AS (
        SELECT
          mp.user_pubkey AS address,
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::bigint AS wr_wins,
          COUNT(*)::bigint AS wr_total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE ms.settled = TRUE
          AND ms.winning_side IN (1,2)
        GROUP BY mp.user_pubkey
      ),
      wr AS (
        SELECT
          address,
          wr_wins,
          wr_total,
          CASE
            WHEN wr_total = 0 THEN 0::float8
            ELSE ROUND((wr_wins::numeric / wr_total::numeric) * 100.0, 1)::float8
          END AS win_rate
        FROM wr_all
      ),

      ranked AS (
        SELECT
          c.address,
          c.total_bets,
          c.volume_1e6,
          c.wins_bets_based,
          c.points_total,
          c.level,
          CASE
            WHEN c.total_bets = 0 THEN 0::float8
            ELSE (c.wins_bets_based::numeric / c.total_bets::numeric)
          END AS bets_ratio,
          ROW_NUMBER() OVER (
            ORDER BY c.points_total DESC,
                      (CASE WHEN c.total_bets = 0 THEN 0 ELSE (c.wins_bets_based::numeric / c.total_bets::numeric) END) DESC,
                      c.volume_1e6 DESC,
                      c.address ASC
          )::bigint AS rnk
        FROM curr c
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
          )::bigint AS wins_bets_based,
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
                      (CASE WHEN total_bets = 0 THEN 0 ELSE (wins_bets_based::numeric / total_bets::numeric) END) DESC,
                      volume_1e6 DESC,
                      address ASC
          )::bigint AS prev_rnk
        FROM prev_raw
      ),

      outcomes AS (
        SELECT
          mp.user_pubkey AS address,
          ms.updated_at,
          CASE
            WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
              OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
            THEN TRUE ELSE FALSE
          END AS won
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE ms.settled = TRUE
          AND ms.winning_side IN (1,2)
      ),
      ordered AS (
        SELECT
          address,
          won,
          SUM(CASE WHEN won THEN 0 ELSE 1 END)
            OVER (PARTITION BY address ORDER BY updated_at DESC
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS loss_block
        FROM outcomes
      ),
      streaks AS (
        SELECT address, COUNT(*)::bigint AS streak
        FROM ordered
        WHERE loss_block = 0 AND won = TRUE
        GROUP BY address
      )

      SELECT
        COALESCE(r.rnk, 0)::bigint          AS rank,
        pr.prev_rnk                          AS prev_rank,
        COALESCE(r.address, '')              AS address,

        COALESCE(wr.win_rate, 0::float8)     AS win_rate,

        COALESCE(r.total_bets, 0)::bigint    AS total_bets,
        COALESCE(r.volume_1e6, 0)::bigint    AS volume_1e6,
        COALESCE(r.level, 'Observer')        AS level,
        COALESCE(r.points_total, 0)::bigint  AS points_total,
        COALESCE(
          CASE
            WHEN pr.prev_rnk IS NULL AND (SELECT prev_start_ts FROM params) IS NOT NULL THEN 'new'
            WHEN pr.prev_rnk IS NULL THEN 'same'
            WHEN pr.prev_rnk > r.rnk THEN 'up'
            WHEN pr.prev_rnk < r.rnk THEN 'down'
            ELSE 'same'
          END,
          'same'
        ) AS change,
        COALESCE(s.streak, 0)::bigint        AS streak
      FROM ranked r
      LEFT JOIN prev_ranked pr USING (address)
      LEFT JOIN wr          ON wr.address = r.address
      LEFT JOIN streaks s   ON s.address   = r.address
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
            streak: row.streak.unwrap_or(0) as i64,
            level: row.level.unwrap_or_else(|| "Observer".to_string()),
            points: row.points_total.unwrap_or(0) as i64,
            change: row.change.unwrap_or_else(|| "same".to_string()),
        })
        .collect();

    Ok(out)
}
