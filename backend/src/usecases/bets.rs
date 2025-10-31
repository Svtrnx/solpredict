use sqlx::PgPool;
use uuid::Uuid;

use crate::repo::{points as points_repo, bets as bets_repo};

async fn retry_on_serialization_error<F, T, Fut>(
    mut operation: F,
    max_retries: u32,
) -> anyhow::Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<T>>,
{
    let mut attempt = 0;
    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                let is_serialization_error = e
                    .chain()
                    .any(|cause| {
                        if let Some(db_err) = cause.downcast_ref::<sqlx::Error>() {
                            if let sqlx::Error::Database(pg_err) = db_err {
                                return pg_err.code().as_deref() == Some("40001");
                            }
                        }
                        false
                    });

                if is_serialization_error && attempt < max_retries {
                    attempt += 1;
                    let delay_ms = 10u64 * 2u64.pow(attempt - 1); // 10ms, 20ms, 40ms, 80ms, 160ms
                    tracing::warn!(
                        attempt = attempt,
                        delay_ms = delay_ms,
                        "Serialization error detected, retrying operation"
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                    continue;
                }

                return Err(e);
            }
        }
    }
}

pub async fn record_bet_and_points(
    pool: &PgPool,
    market_id: Uuid,
    user_wallet: &str,
    outcome_idx: u8,
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    retry_on_serialization_error(
        || async {
            bets_repo::insert_bet_and_upsert_position(
                pool,
                market_id,
                user_wallet,
                outcome_idx,
                amount_1e6,
                tx_sig,
                None
            )
            .await
        },
        5
    )
    .await?;

    let points = points_repo::award_bet_points(
        pool,
        user_wallet,
        market_id,
        None,
        amount_1e6,
        tx_sig,
    )
    .await?;

    Ok(points)
}
