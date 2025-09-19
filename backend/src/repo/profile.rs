use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Serialize, Debug)]
pub struct WalletOverview {
    pub address: String, // Wallet address

    pub total_volume: f64,
    pub total_bets: i64,   // Total number of bets
    pub active_bets: i64,  // Active bets count

    pub win_rate: f64,        // Win rate (%) (range: 0..100)
    pub win_rate_change: f64,

    pub rank: i64,        // Rank based on total points
    pub rank_change: i64, // Rank change over the past 7 days

    pub level: String, // Wallet level
    pub points: i64,   // Total accumulated points

    pub streak: i64,       // Current win streak
    pub join_date: String, // Join date (dd.mm.yyyy)
}

pub async fn get_wallet_overview(
    pool: &PgPool,
    wallet_id: Uuid,
    wallet_address: &str,
) -> anyhow::Result<WalletOverview> {
    // 1) Basic wallet info
    #[derive(sqlx::FromRow)]
    struct WRow {
        created_at: chrono::DateTime<chrono::Utc>,
        points_total: i64,
        tier_label: Option<String>,
    }

    let w: WRow = sqlx::query_as::<_, WRow>(
        r#"
    SELECT
        w.created_at,
        w.points_total,
        COALESCE(v.tier, 'Observer') AS tier_label
    FROM wallets w
    LEFT JOIN wallet_tiers v
           ON v.id = w.id          -- important: wallet_tiers.id == wallets.id
    WHERE w.id = $1
    "#,
    )
    .bind(wallet_id) // UUID
    .fetch_one(pool)
    .await?;

    let join_date = w.created_at.format("%d.%m.%Y").to_string();

    // Total volume and number of bets
    #[derive(sqlx::FromRow)]
    struct VolRow {
        total: i64,
        cnt: i64,
    }

    let vol: VolRow = sqlx::query_as(
        r#"
    SELECT 
        COALESCE(SUM(amount_1e6), 0)::BIGINT AS total,
        COUNT(*)::BIGINT                      AS cnt
    FROM market_bets
    WHERE user_pubkey = $1
    "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    // Active bets (positions in unresolved markets)
    let active_bets: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = FALSE
          AND (mp.yes_bet_1e6 > 0 OR mp.no_bet_1e6 > 0)
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    // Overall win rate
    #[derive(sqlx::FromRow)]
    struct WinRow {
        wins: Option<i64>,
        total: i64,
    }
    let win_all: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)   -- ignore VOID/UNDEF
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let win_rate = if win_all.total > 0 {
        (win_all.wins.unwrap_or(0) as f64) * 100.0 / (win_all.total as f64)
    } else {
        0.0
    };

    // winRate for the last week vs the previous week — for (Delta) calculation
    let win_last7: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
          AND ms.updated_at >= now() - interval '7 days'
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let win_prev7: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
          AND ms.updated_at >= now() - interval '14 days'
          AND ms.updated_at <  now() - interval '7 days'
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let wr_7 = if win_last7.total > 0 {
        (win_last7.wins.unwrap_or(0) as f64) * 100.0 / (win_last7.total as f64)
    } else {
        0.0
    };
    let wr_p7 = if win_prev7.total > 0 {
        (win_prev7.wins.unwrap_or(0) as f64) * 100.0 / (win_prev7.total as f64)
    } else {
        0.0
    };
    let win_rate_change = wr_7 - wr_p7;

    // Rank by total points
    let rank: i64 = sqlx::query_scalar(
        r#"
        WITH ranked AS (
          SELECT id, DENSE_RANK() OVER (ORDER BY points_total DESC) AS r
          FROM wallets
        )
        SELECT r FROM ranked WHERE id = $1
        "#,
    )
    .bind(wallet_id)
    .fetch_one(pool)
    .await?;

    // Rank change based on points gained in the last 7d vs previous 7d
    #[derive(sqlx::FromRow)]
    struct RankDelta {
        rank_7d: i64,
        rank_prev_7d: i64,
    }
    let rd: RankDelta = sqlx::query_as(
        r#"
        WITH p AS (
          SELECT w.id AS wallet_id,
                 COALESCE(SUM(CASE WHEN pe.created_at >= now() - interval '7 days'
                                   THEN pe.points_delta END), 0) AS pts_7d,
                 COALESCE(SUM(CASE WHEN pe.created_at >= now() - interval '14 days'
                                    AND pe.created_at <  now() - interval '7 days'
                                   THEN pe.points_delta END), 0) AS pts_prev_7d
          FROM wallets w
          LEFT JOIN points_events pe ON pe.wallet_id = w.id
          GROUP BY w.id
        ),
        r AS (
          SELECT wallet_id,
                 DENSE_RANK() OVER (ORDER BY pts_7d DESC)      AS rank_7d,
                 DENSE_RANK() OVER (ORDER BY pts_prev_7d DESC) AS rank_prev_7d
          FROM p
        )
        SELECT rank_7d, rank_prev_7d FROM r WHERE wallet_id = $1
        "#,
    )
    .bind(wallet_id)
    .fetch_one(pool)
    .await?;

    let rank_change = rd.rank_prev_7d - rd.rank_7d; // + => improved position

    // Streak (winning streak) — calculated in code
    #[derive(sqlx::FromRow)]
    struct Outcome {
        won: bool,
    }
    let outcomes: Vec<Outcome> = sqlx::query_as(
        r#"
        SELECT
          CASE
            WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
              OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
            THEN TRUE ELSE FALSE END AS won
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
        ORDER BY ms.updated_at
        "#,
    )
    .bind(wallet_address)
    .fetch_all(pool)
    .await?;

    let mut streak: i64 = 0;
    for o in outcomes.iter().rev() {
        if o.won {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(WalletOverview {
        address: wallet_address.to_string(),
        total_volume: (vol.total as f64) / 1_000_000.0,
        total_bets: vol.cnt,
        active_bets,

        win_rate: win_rate,
        win_rate_change,

        rank,
        rank_change,

        level: w.tier_label.unwrap_or_else(|| "Observer".to_string()),
        points: w.points_total,

        streak,
        join_date,
    })
}


pub async fn get_wallet_overview_by_address(
    pool: &PgPool,
    wallet_address: &str,
) -> anyhow::Result<WalletOverview> {

    // Basic info
    #[derive(sqlx::FromRow)]
    struct BaseRow {
        created_at: chrono::DateTime<chrono::Utc>,
        points_total: i64,
        tier_label: Option<String>,
    }

    // Using CTE: fetch wallet id by address and join tier
    let base: BaseRow = sqlx::query_as::<_, BaseRow>(
        r#"
        WITH wid AS (
          SELECT id, created_at, points_total
          FROM wallets
          WHERE wallet_address = $1
        )
        SELECT
          w.created_at,
          w.points_total,
          COALESCE(t.tier, 'Observer') AS tier_label,
          w.id AS wallet_id
        FROM wid w
        LEFT JOIN wallet_tiers t ON t.id = w.id
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let join_date = base.created_at.format("%d.%m.%Y").to_string();

    // Total volume and number of bets (by address)
    #[derive(sqlx::FromRow)]
    struct VolRow {
        total: i64,
        cnt: i64,
    }

    let vol: VolRow = sqlx::query_as(
        r#"
        SELECT COALESCE(SUM(amount_1e6), 0)::BIGINT AS total,
               COUNT(*)::BIGINT AS cnt
        FROM market_bets
        WHERE user_pubkey = $1
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    // Active bets (by address)
    let active_bets: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = FALSE
          AND (mp.yes_bet_1e6 > 0 OR mp.no_bet_1e6 > 0)
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    // Overall win-rate (by address)
    #[derive(sqlx::FromRow)]
    struct WinRow {
        wins: Option<i64>,
        total: i64,
    }

    let win_all: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let win_rate = if win_all.total > 0 {
        (win_all.wins.unwrap_or(0) as f64) * 100.0 / (win_all.total as f64)
    } else {
        0.0
    };

    // Win-rate (Delta) for the last 7d (by address)
    let win_last7: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
          AND ms.updated_at >= now() - interval '7 days'
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let win_prev7: WinRow = sqlx::query_as(
        r#"
        SELECT
          SUM(
            CASE
              WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
                OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
              THEN 1 ELSE 0
            END
          )::BIGINT AS wins,
          COUNT(*)::BIGINT AS total
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
          AND ms.updated_at >= now() - interval '14 days'
          AND ms.updated_at <  now() - interval '7 days'
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let wr_7 = if win_last7.total > 0 {
        (win_last7.wins.unwrap_or(0) as f64) * 100.0 / (win_last7.total as f64)
    } else {
        0.0
    };
    let wr_p7 = if win_prev7.total > 0 {
        (win_prev7.wins.unwrap_or(0) as f64) * 100.0 / (win_prev7.total as f64)
    } else {
        0.0
    };
    let win_rate_change = wr_7 - wr_p7;

    // Rank by points_total (id from CTE)
    let rank: i64 = sqlx::query_scalar(
        r#"
        WITH wid AS (
          SELECT id FROM wallets WHERE wallet_address = $1
        ),
        ranked AS (
          SELECT id, DENSE_RANK() OVER (ORDER BY points_total DESC) AS r
          FROM wallets
        )
        SELECT r FROM ranked WHERE id = (SELECT id FROM wid)
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    // Rank change over the last week (by id)
    #[derive(sqlx::FromRow)]
    struct RankDelta {
        rank_7d: i64,
        rank_prev_7d: i64,
    }

    let rd: RankDelta = sqlx::query_as(
        r#"
        WITH wid AS (SELECT id FROM wallets WHERE wallet_address = $1),
        p AS (
          SELECT w.id AS wallet_id,
                 COALESCE(SUM(CASE WHEN pe.created_at >= now() - interval '7 days'
                                   THEN pe.points_delta END), 0) AS pts_7d,
                 COALESCE(SUM(CASE WHEN pe.created_at >= now() - interval '14 days'
                                    AND pe.created_at <  now() - interval '7 days'
                                   THEN pe.points_delta END), 0) AS pts_prev_7d
          FROM wallets w
          LEFT JOIN points_events pe ON pe.wallet_id = w.id
          GROUP BY w.id
        ),
        r AS (
          SELECT wallet_id,
                 DENSE_RANK() OVER (ORDER BY pts_7d DESC)      AS rank_7d,
                 DENSE_RANK() OVER (ORDER BY pts_prev_7d DESC) AS rank_prev_7d
          FROM p
        )
        SELECT r.rank_7d, r.rank_prev_7d
        FROM r
        WHERE r.wallet_id = (SELECT id FROM wid)
        "#,
    )
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    let rank_change = rd.rank_prev_7d - rd.rank_7d;

    // Winning streak (by address)
    #[derive(sqlx::FromRow)]
    struct Outcome {
        won: bool,
    }

    let outcomes: Vec<Outcome> = sqlx::query_as(
        r#"
        SELECT
          CASE
            WHEN (ms.winning_side = 1 AND mp.yes_bet_1e6 > 0)
              OR (ms.winning_side = 2 AND mp.no_bet_1e6 > 0)
            THEN TRUE ELSE FALSE END AS won
        FROM market_positions mp
        JOIN market_state ms ON ms.market_id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND ms.settled = TRUE
          AND ms.winning_side IN (1,2)
        ORDER BY ms.updated_at
        "#,
    )
    .bind(wallet_address)
    .fetch_all(pool)
    .await?;

    let mut streak: i64 = 0;
    for o in outcomes.iter().rev() {
        if o.won {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(WalletOverview {
        address: wallet_address.to_string(),
        total_volume: (vol.total as f64) / 1_000_000.0,
        total_bets: vol.cnt,
        active_bets,

        win_rate,
        win_rate_change,

        rank,
        rank_change,

        level: base.tier_label.unwrap_or_else(|| "Observer".to_string()),
        points: base.points_total,

        streak,
        join_date,
    })
}
