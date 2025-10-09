use axum::{Router, routing::{get, post}};
use crate::state::SharedState;

pub mod markets;
pub mod create;
pub mod types;
pub mod claim;
mod place_bet;
mod resolve;

pub fn public_routes() -> Router<SharedState> {
    Router::new()
    .route("/markets", get(markets::list))
    .route("/markets/bets", get(markets::recent_bets))
    .route("/markets/{market_address}", get(markets::handle))
}

pub fn protected_routes() -> Router<SharedState> {
    Router::new()
        .route("/markets", post(create::create_market))
        .route("/markets/bets/tx", post(place_bet::prepare_place_tx))
        .route("/markets/resolve/ix", post(resolve::build_resolve_ix))
        .route("/markets/claim/tx", post(claim::prepare_claim_tx))
}
