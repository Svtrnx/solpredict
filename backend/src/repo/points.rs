use sqlx::{PgPool, Transaction, Postgres};
use uuid::Uuid;
use anyhow::Context;

/// Awards loyalty points for a placed bet 
pub async fn award_bet_points(
    pool: &PgPool,
    wallet_address: &str,
    market_id: Uuid,
    bet_id: Option<i64>, 
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    if wallet_address.is_empty() {
        return Err(anyhow::anyhow!("wallet_address cannot be empty"));
    }
    
    if tx_sig.is_empty() {
        return Err(anyhow::anyhow!("tx_sig cannot be empty"));
    }
    
    if amount_1e6 <= 0 {
        return Err(anyhow::anyhow!("amount_1e6 must be positive, got {}", amount_1e6));
    }
    
    const MAX_AMOUNT: i64 = 1_000_000_000_000_000; // 1B * 1e6
    if amount_1e6 > MAX_AMOUNT {
        return Err(anyhow::anyhow!("amount_1e6 exceeds maximum: {}", MAX_AMOUNT));
    }

    let mut points_delta = amount_1e6 / 1_000_000;
    
    if amount_1e6 % 1_000_000 >= 500_000 {
        points_delta += 1;
    }
    
    const MIN_AMOUNT_FOR_POINTS: i64 = 10_000; // 0.01 USD minimum
    if amount_1e6 < MIN_AMOUNT_FOR_POINTS {
        tracing::debug!(
            wallet = %wallet_address,
            amount_1e6 = amount_1e6,
            "Bet amount too small for points"
        );
        return Ok(0);
    }
    
    if points_delta < 1 {
        points_delta = 1;
    }

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;
    
    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await
        .context("Failed to set transaction isolation level")?;

    let wallet_id = sqlx::query_scalar!(
        r#"
        SELECT id as "id: Uuid"
        FROM wallets
        WHERE wallet_address = $1
        "#,
        wallet_address
    )
    .fetch_optional(&mut *tx)
    .await?;

    let Some(wallet_id) = wallet_id else {
        tracing::warn!(
            wallet_address = %wallet_address,
            tx_sig = %tx_sig,
            "Wallet not found when awarding points - wallet may need registration"
        );
        return Ok(0);
    };

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
    .fetch_optional(&mut *tx)
    .await?;

    let awarded_points = if inserted.is_some() {
        let current_points = sqlx::query_scalar!(
            r#"
            SELECT points_total AS "points_total!"
            FROM wallets
            WHERE id = $1
            "#,
            wallet_id
        )
        .fetch_one(&mut *tx)
        .await?;
        
        const MAX_SAFE_POINTS: i64 = i64::MAX / 10 * 9;
        if current_points > MAX_SAFE_POINTS - points_delta {
            tracing::error!(
                wallet_id = %wallet_id,
                current = current_points,
                delta = points_delta,
                "Points would overflow maximum safe value"
            );
            return Err(anyhow::anyhow!("Points total would exceed maximum"));
        }
        
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
        .execute(&mut *tx)
        .await?;
        
        tracing::info!(
            wallet = %wallet_address,
            market_id = %market_id,
            bet_id = ?bet_id,
            amount = amount_1e6,
            points = points_delta,
            tx_sig = %tx_sig,
            "Points awarded successfully"
        );
        
        points_delta
    } else {
        tracing::debug!(
            wallet = %wallet_address,
            tx_sig = %tx_sig,
            "Duplicate points award attempt detected (idempotent)"
        );
        0
    };

    tx.commit().await?;
    
    Ok(awarded_points)
}