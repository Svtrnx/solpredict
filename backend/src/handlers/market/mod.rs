use crate::state::SharedState;
use axum::{Router, routing::{get, post}};

pub mod markets;
pub mod create;
pub mod types;
mod confirm;
mod get;

pub fn public_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", get(markets::list))
        .route("/markets/{market_address}", get(get::handle))
}

pub fn protected_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", post(create::create_market))
        .route("/markets/confirm", post(confirm::confirm_market))
}
