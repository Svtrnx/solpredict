use sqlx::PgPool;
use uuid::Uuid;

/// Awards loyalty points for a placed bet 
pub async fn award_bet_points(
    pool: &PgPool,
    wallet_address: &str,
    market_id: Uuid,
    bet_id: Option<i64>, 
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    let wallet_id = sqlx::query_scalar!(
        r#"
        SELECT id as "id: Uuid"
        FROM wallets
        WHERE wallet_address = $1
        "#,
        wallet_address
    )
    .fetch_optional(pool)
    .await?;

    let Some(wallet_id) = wallet_id else {
        return Ok(0);
    };

    let mut points_delta = ((amount_1e6 as f64) / 1_000_000.0).round() as i64;
    if points_delta < 1 { points_delta = 1; }

    let inserted = sqlx::query_scalar!(
        r#"
        INSERT INTO points_events
            (wallet_id, market_id, bet_id, action, amount_1e6, points_delta, tx_sig)
        VALUES ($1,       $2,        $3,    'bet',  $4,         $5,          $6)
        ON CONFLICT (action, tx_sig, wallet_id) DO NOTHING
        RETURNING points_delta
        "#,
        wallet_id,
        market_id,
        bet_id,
        amount_1e6,
        points_delta,
        tx_sig
    )
    .fetch_optional(pool)
    .await?;

    if inserted.is_some() {
        sqlx::query!(
            r#"
            UPDATE wallets
            SET points_total = points_total + $1,
                last_points_at = now()
            WHERE id = $2
            "#,
            points_delta,
            wallet_id
        )
        .execute(pool)
        .await?;
        Ok(points_delta)
    } else {
        Ok(0)
    }
}
