use axum::{Json, extract::State, http::HeaderMap};
use anchor_client::solana_sdk::pubkey::Pubkey;
use serde::{Deserialize};
use std::str::FromStr;

use crate::{
    handlers::market::types::current_user_pubkey,
    solana::anchor_client as anchor_client_,
    types::ix::ResolveIxBundle,
    state::SharedState,
    error::AppError,
};

// Request / Response
#[derive(Deserialize)]
pub struct ResolveIxRequest {
    pub market_pda: String,
}

pub async fn build_resolve_ix(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<ResolveIxRequest>,
) -> Result<Json<ResolveIxBundle>, AppError> {
    let resolver_pk = current_user_pubkey(&headers, &state.jwt_secret)?;
    let market_pda  = Pubkey::from_str(&req.market_pda)
        .map_err(|_| AppError::bad_request("bad market_pda"))?;
    tracing::info!("Building resolve ix for market");
    let ctx = state.anchor.clone();
    let bundle = tokio::task::spawn_blocking(move || {
        anchor_client_::build_resolve_ix_bundle(&ctx, resolver_pk, market_pda)
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("join error: {e}")))??;

    Ok(Json(bundle))
}