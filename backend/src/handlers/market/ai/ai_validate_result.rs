use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;

use crate::{
    {error::AppError, state::SharedState},
    usecases::ai_jobs::{AiJobValue, get_job}
};

// ====== GET /v1/markets/ai/validate/select ======
pub async fn get_ai_validate_result(
    State(state): State<SharedState>,
    Path(hash): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    match get_job(&state, &hash).await.map_err(AppError::Other)? {
        None => Ok((
            StatusCode::NOT_FOUND,
            Json(json!({ "status": "expired" })),
        )),

        Some(AiJobValue::Pending { meta }) => Ok((
            StatusCode::OK,
            Json(json!({
                "status": "pending",
                "meta": meta
            })),
        )),

        Some(AiJobValue::Error { error, meta }) => Ok((
            StatusCode::OK,
            Json(json!({
                "status": "error",
                "error":  error,
                "meta":   meta
            })),
        )),

        Some(AiJobValue::Ready { data, meta }) => {
            if !data.accept {
                Ok((
                    StatusCode::OK,
                    Json(json!({
                        "status": "rejected",
                        "reason": data.reason,
                        "meta":   meta
                    })),
                ))
            } else {
                Ok((
                    StatusCode::OK,
                    Json(json!({
                        "status": "ready",
                        "data":   data,
                        "meta":   meta
                    })),
                ))
            }
        }
    }
}
