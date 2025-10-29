use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{error::AppError, state::SharedState};
use crate::usecases::{
    ai_jobs::{compute_hash, put_pending, spawn_normalization_job, AiJobMeta},
    market_category::MarketCategory
};

#[derive(Deserialize)]
pub struct AiValidateStartReq {
    pub query: String,
    pub category: MarketCategory, // "politics" | "war"
}

#[derive(Serialize)]
pub struct AiValidateStartResp {
    pub ok: bool,
    pub hash: String,
}

pub async fn post_ai_validate_start(
    State(state): State<SharedState>,
    Json(req): Json<AiValidateStartReq>,
) -> Result<Json<AiValidateStartResp>, AppError> {
    let q = req.query.trim();
    if q.is_empty() {
        return Err(AppError::bad_request("query is empty"));
    }
    if q.chars().count() > 80 {
        return Err(AppError::bad_request("query must be ≤ 80 characters"));
    }

    let hash = compute_hash(q, req.category);

    let meta = AiJobMeta {
        query: q.to_string(),
        category: req.category,
        created_at_utc: time::OffsetDateTime::now_utc().unix_timestamp(),
    };

    // pending
    put_pending(&state, &hash, meta.clone()).await.map_err(AppError::Other)?;

    // fire-and-forget job
    spawn_normalization_job(state.clone(), hash.clone(), q.to_owned(), req.category);

    Ok(Json(AiValidateStartResp { ok: true, hash }))
}
