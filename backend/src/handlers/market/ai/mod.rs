use axum::{Router, routing::{get, post}};
use crate::state::SharedState;

pub mod ai_validate_select;
pub mod ai_validate_result;
pub mod ai_validate_start;

pub fn protected_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets/ai/validate/select", post(ai_validate_select::post_ai_validate_select))
        .route("/markets/ai/validate/start", post(ai_validate_start::post_ai_validate_start))
        .route("/markets/ai/validate/result/{hash}", get(ai_validate_result::get_ai_validate_result))
}
