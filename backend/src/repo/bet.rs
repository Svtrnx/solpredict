use sqlx::{PgPool, Postgres, Transaction};

pub async fn insert_bet_and_upsert_position(
    pool: &PgPool,
    market_id: uuid::Uuid,
    user_pubkey: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
    block_time: Option<chrono::DateTime<chrono::Utc>>,
) -> anyhow::Result<Option<i64>> {
    let mut tx: Transaction<Postgres> = pool.begin().await?;

    let side_str = if side_yes { "yes" } else { "no" };

    // Screenshot of pools before insertion
    let (yes_before, no_before): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
        COALESCE( (SUM(CASE WHEN side='yes' THEN amount_1e6 ELSE 0 END))::BIGINT, 0 ) AS yes_total,
        COALESCE( (SUM(CASE WHEN side='no'  THEN amount_1e6 ELSE 0 END))::BIGINT, 0 ) AS no_total
        FROM market_bets
        WHERE market_id = $1
    "#,
    )
    .bind(market_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_before = yes_before + no_before;
    let price_yes_bp_at_bet: i32 = if total_before > 0 {
        (((yes_before as f64) / (total_before as f64)) * 10_000.0).round() as i32
    } else {
        5_000 // 50% when there is no pool (first bet/seed)
    };

    // Idempotent bet insertion with entry price
    let bet_id: Option<i64> = sqlx::query_scalar(
    r#"
        INSERT INTO market_bets
        (market_id, user_pubkey, side, amount_1e6,
        price_yes_bp_at_bet,
        yes_total_before_1e6, no_total_before_1e6,
        tx_sig, block_time)
        VALUES ($1, $2, $3, $4,
                $5,
                $6, $7,
                $8, $9)
        ON CONFLICT (tx_sig) DO NOTHING
        RETURNING id::BIGINT
    "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(side_str)
    .bind(amount_1e6)
    .bind(price_yes_bp_at_bet)
    .bind(yes_before)
    .bind(no_before) 
    .bind(tx_sig)
    .bind(block_time)
    .fetch_optional(&mut *tx)
    .await?;

    // If it's a duplicate, leave the position alone.
    if bet_id.is_none() {
        tx.rollback().await?;
        return Ok(None);
    }

    // Update of the user's aggregated position in the market
    let (yes_delta, no_delta) = if side_yes {
        (amount_1e6, 0)
    } else {
        (0, amount_1e6)
    };

    sqlx::query(
        r#"
        INSERT INTO market_positions (market_id, user_pubkey, yes_bet_1e6, no_bet_1e6)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (market_id, user_pubkey) DO UPDATE
        SET
          yes_bet_1e6 = market_positions.yes_bet_1e6 + EXCLUDED.yes_bet_1e6,
          no_bet_1e6  = market_positions.no_bet_1e6  + EXCLUDED.no_bet_1e6
        "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(yes_delta)
    .bind(no_delta)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(bet_id)
}
