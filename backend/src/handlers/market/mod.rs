use crate::state::SharedState;
use axum::{Router, routing::post};

mod confirm;
pub mod create;

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", post(create::create_market))
        .route("/markets/confirm", post(confirm::confirm_market))
}
