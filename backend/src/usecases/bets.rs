use sqlx::PgPool;
use uuid::Uuid;

use crate::repo::{points as points_repo, bets as bets_repo};

pub async fn record_bet_and_points(
    pool: &PgPool,
    market_id: Uuid,
    user_wallet: &str,
    outcome_idx: u8,
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    bets_repo::insert_bet_and_upsert_position(
        pool,
        market_id,
        user_wallet,
        outcome_idx,
        amount_1e6,
        tx_sig,
        None
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
