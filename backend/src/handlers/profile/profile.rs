use axum::{Extension, Json, extract::{Path, State}, http::StatusCode};
use crate::{middleware::auth::CurrentUser, state::SharedState};
use serde::Serialize;
use uuid::Uuid;

use crate::repo::profile as profile_repo;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletOverviewResponse {
    ok: bool,
    address: String,
    total_volume: f64,
    total_bets: i64,
    active_bets: i64,
    win_rate: f64,
    win_rate_change: f64,
    rank: i64,
    rank_change: i64,
    level: String,
    points: i64,
    streak: i64,
    join_date: String,
}

// ====== GET /v1/profile/overview ======

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
        total_volume: ov.total_volume,
        total_bets: ov.total_bets,
        active_bets: ov.active_bets,
        win_rate: ov.win_rate,
        win_rate_change: ov.win_rate_change,
        rank: ov.rank,
        rank_change: ov.rank_change,
        level: ov.level,
        points: ov.points,
        streak: ov.streak,
        join_date: ov.join_date,
    }))
}

// ====== GET /v1//profile/{wallet} ======

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
        total_volume: ov.total_volume,
        total_bets: ov.total_bets,
        active_bets: ov.active_bets,
        win_rate: ov.win_rate,
        win_rate_change: ov.win_rate_change,
        rank: ov.rank,
        rank_change: ov.rank_change,
        level: ov.level,
        points: ov.points,
        streak: ov.streak,
        join_date: ov.join_date,
    }))
}
