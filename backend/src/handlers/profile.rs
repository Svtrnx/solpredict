use axum::{Extension, Json, extract::{Path, State}, http::StatusCode};
use serde::Serialize;
use uuid::Uuid;

use crate::repo::profile as profile_repo;
use crate::{middleware::auth::CurrentUser, state::SharedState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletOverviewResponse {
    ok: bool,
    address: String,
    totalVolume: f64,
    totalBets: i64,
    activeBets: i64,
    winRate: f64,
    winRateChange: f64,
    rank: i64,
    rankChange: i64,
    level: String,
    points: i64,
    streak: i64,
    joinDate: String,
}

pub async fn wallet_overview(
    State(state): State<SharedState>,
    Extension(current_user): Extension<CurrentUser>,
) -> Result<Json<WalletOverviewResponse>, (StatusCode, String)> {
    let wallet_uuid = Uuid::parse_str(&current_user.wallet_id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "wallet_id is not a valid UUID".to_string(),
        )
    })?;
    let wallet_address = &current_user.wallet;

    let ov = profile_repo::get_wallet_overview(state.db.pool(), wallet_uuid, wallet_address)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    Ok(Json(WalletOverviewResponse {
        ok: true,
        address: ov.address,
        totalVolume: ov.total_volume,
        totalBets: ov.total_bets,
        activeBets: ov.active_bets,
        winRate: ov.win_rate,
        winRateChange: ov.win_rate_change,
        rank: ov.rank,
        rankChange: ov.rank_change,
        level: ov.level,
        points: ov.points,
        streak: ov.streak,
        joinDate: ov.join_date,
    }))
}

pub async fn wallet_overview_public(
    State(state): State<SharedState>,
    Path(wallet): Path<String>,
) -> Result<Json<WalletOverviewResponse>, (StatusCode, String)> {
    let ov = profile_repo::get_wallet_overview_by_address(state.db.pool(), &wallet)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    Ok(Json(WalletOverviewResponse {
        ok: true,
        address: ov.address,
        totalVolume: ov.total_volume,
        totalBets: ov.total_bets,
        activeBets: ov.active_bets,
        winRate: ov.win_rate,
        winRateChange: ov.win_rate_change,
        rank: ov.rank,
        rankChange: ov.rank_change,
        level: ov.level,
        points: ov.points,
        streak: ov.streak,
        joinDate: ov.join_date,
    }))
}
