use sqlx::PgPool;
use uuid::Uuid;

use crate::repo::{position as pos_repo, points as points_repo};

pub async fn record_bet_and_points(
    pool: &PgPool,
    market_id: Uuid,
    user_wallet: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
) -> anyhow::Result<i64> {
    pos_repo::apply_bet_to_position(
        pool,
        market_id,
        user_wallet,
        side_yes,
        amount_1e6,
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
