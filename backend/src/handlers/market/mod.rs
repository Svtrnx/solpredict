use crate::state::SharedState;
use axum::{Router, routing::{get, post}};

mod confirm;
pub mod markets;
pub mod create;

pub fn public_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", get(markets::list_markets))
}

pub fn protected_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", post(create::create_market))
        .route("/markets/confirm", post(confirm::confirm_market))
}
