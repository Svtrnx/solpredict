use sqlx::PgPool;
use uuid::Uuid;

use crate::repo::{bets as bets_repo, points as points_repo};

pub async fn record_bet_and_points(
    pool: &PgPool,
    market_id: Uuid,
    user_wallet: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    let bet_id = bets_repo::insert_bet_and_upsert_position(
        pool,
        market_id,
        user_wallet,
        side_yes,
        amount_1e6,
        tx_sig,
        None, // block_time
    )
    .await?;

    points_repo::award_bet_points(
        pool,
        user_wallet,
        market_id,
        bet_id,
        amount_1e6,
        tx_sig,
    )
    .await?;

    Ok(bet_id)
}
