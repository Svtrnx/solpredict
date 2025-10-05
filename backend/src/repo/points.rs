use sqlx::PgPool;
use uuid::Uuid;

/// Awards loyalty points for a placed bet 
pub async fn award_bet_points(
    pool: &PgPool,
    wallet_address: &str, // base58 wallet address
    market_id: Uuid,
    bet_id: i64,          // market_bets.id
    amount_1e6: i64,      // bet amount in 1e6
    tx_sig: &str,         // transaction signature
) -> anyhow::Result<i64> {
    // Retrieve the wallet ID based on the wallet address
    let wallet_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM wallets WHERE wallet_address = $1")
            .bind(wallet_address)
            .fetch_optional(pool)
            .await?;

    let Some(wallet_id) = wallet_id else {
        return Ok(0);
    };

    let points_delta: i64 = ((amount_1e6 as f64) / 1_000_000.0).round() as i64;
    let points_delta = points_delta.max(1);

    let inserted: Option<i64> = sqlx::query_scalar(
        r#"
            INSERT INTO points_events
            (wallet_id, market_id, bet_id, action, amount_1e6, points_delta, tx_sig)
            VALUES ($1, $2, $3, 'bet', $4, $5, $6)
            ON CONFLICT (action, tx_sig, wallet_id) DO NOTHING
            RETURNING points_delta
        "#,
    )
    .bind(wallet_id)
    .bind(market_id)
    .bind(bet_id)
    .bind(amount_1e6)
    .bind(points_delta)
    .bind(tx_sig)
    .fetch_optional(pool)
    .await?;

    // If the insert was successful, update the wallet’s aggregate points
    if inserted.is_some() {
        sqlx::query(
            "UPDATE wallets
            SET points_total = points_total + $1,
                last_points_at = now()
            WHERE id = $2",
        )
        .bind(points_delta)
        .bind(wallet_id)
        .execute(pool)
        .await?;
        Ok(points_delta)
    } else {
        // Duplicate event — no changes made
        Ok(0)
    }
}
