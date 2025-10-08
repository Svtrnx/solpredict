use axum::{extract::{State, Query}, Json};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use crate::{
    error::AppError,
    repo::users as users_repo,
    state::SharedState,
};

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum LeaderboardPeriodApi {
    AllTime,
    Monthly,
    Weekly,
}
impl Default for LeaderboardPeriodApi {
    fn default() -> Self { Self::AllTime }
}
impl From<LeaderboardPeriodApi> for users_repo::LeaderboardPeriod {
    fn from(v: LeaderboardPeriodApi) -> Self {
        match v {
            LeaderboardPeriodApi::AllTime => users_repo::LeaderboardPeriod::AllTime,
            LeaderboardPeriodApi::Monthly => users_repo::LeaderboardPeriod::Monthly,
            LeaderboardPeriodApi::Weekly  => users_repo::LeaderboardPeriod::Weekly,
        }
    }
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardQuery {
    #[serde(default)]
    pub period: LeaderboardPeriodApi,  // "all-time" | "monthly" | "weekly"; default = all-time
    #[serde(default)]
    pub limit: Option<i64>,            // default 50, max 100
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardUserDto {
    pub rank: i64,
    pub prev_rank: i64,
    pub address: String,
    pub win_rate: f64,
    pub total_bets: i64,
    pub volume: f64,
    pub streak: i64,
    pub level: String,
    pub points: i64,
    pub change: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardResponse {
    pub period: String,
    pub items: Vec<LeaderboardUserDto>,
}

// ====== GET /v1/leaderboard ======

pub async fn handle(
    State(state): State<SharedState>,
    Query(q): Query<LeaderboardQuery>,
) -> Result<Json<LeaderboardResponse>, AppError> {
    let period_repo: users_repo::LeaderboardPeriod = q.period.into();
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let now = OffsetDateTime::now_utc();

    let rows = users_repo::fetch_leaderboard_users(
        state.db.pool(),
        period_repo,
        now,
        limit,
    )
    .await
    .map_err(AppError::from)?;

    let items: Vec<LeaderboardUserDto> = rows
        .into_iter()
        .map(|r| LeaderboardUserDto {
            rank: r.rank,
            prev_rank: r.prev_rank.unwrap_or(r.rank),
            address: r.address,
            win_rate: r.win_rate,
            total_bets: r.total_bets,
            volume: r.volume,
            streak: r.streak,
            level: r.level,
            points: r.points,
            change: r.change,      // "up" | "down" | "same" | "new"
        })
        .collect();

    let period_str = match q.period {
        LeaderboardPeriodApi::AllTime => "all-time",
        LeaderboardPeriodApi::Monthly => "monthly",
        LeaderboardPeriodApi::Weekly  => "weekly",
    }.to_string();

    Ok(Json(LeaderboardResponse { period: period_str, items }))
}
