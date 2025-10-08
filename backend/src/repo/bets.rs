use sqlx::{PgPool, Transaction, Postgres};
use uuid::Uuid;

pub async fn mark_position_claimed_by_pda(
    pool: &PgPool,
    market_pda: &str,
    user_pubkey: &str,
    tx_sig_claim: &str,
) -> anyhow::Result<()> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let market_id = sqlx::query_scalar!(
        r#"
        SELECT id AS "id: Uuid"
        FROM markets
        WHERE market_pda = $1
        "#,
        market_pda
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO market_positions (
          market_id, user_pubkey, yes_bet_1e6, no_bet_1e6, claimed, tx_sig_claim
        )
        VALUES ($1, $2, 0, 0, TRUE, $3)
        ON CONFLICT (market_id, user_pubkey) DO UPDATE
        SET claimed      = TRUE,
            tx_sig_claim = COALESCE(market_positions.tx_sig_claim, EXCLUDED.tx_sig_claim)
        "#,
        market_id,
        user_pubkey,
        tx_sig_claim
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}
