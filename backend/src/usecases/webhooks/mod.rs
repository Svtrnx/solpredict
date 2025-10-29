pub mod resolve_market;
pub mod create_market;
pub mod place_bet;
pub mod shared;
pub mod claim;

use serde_json::Value;

use shared::{anchor_sighash, extract_instructions, ix_program_id};
use crate::{error::AppError, state};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Method { PlaceBet, CreateMarket, CreateMarketMulti, ResolveMarket, Claim, Unknown }

fn detect_method(ix: &Value) -> Method {
    let bytes = match shared::ix_data_bytes(ix) { Some(b) => b, None => return Method::Unknown };
    let discr = &bytes[..8];
    if discr == anchor_sighash("place_bet") { 
        Method::PlaceBet
    } else if discr == anchor_sighash("create_market") {
        Method::CreateMarket
    } else if discr == anchor_sighash("create_market_multi") {
        Method::CreateMarketMulti
    } else if discr == anchor_sighash("resolve_market") {
        Method::ResolveMarket
    } else if discr == anchor_sighash("claim") {
        Method::Claim
    } else {
         Method::Unknown
        }
}

/// Called from the helius webhook handler
pub async fn handle_helius_raw_item(item: &Value) -> Result<(), AppError> {

	let state = state::global();

	tracing::info!("helius_raw_item: {}", item);
    let (ixs, msg_keys_opt) = extract_instructions(item);

    for ix in ixs {
        if ix_program_id(ix, msg_keys_opt) != Some(&state.program_id) { continue; }

        match detect_method(ix) {
            Method::CreateMarket => {
                if let Err(e) = create_market::handle(item, ix, msg_keys_opt, &state.memo_program, &state.usdc_mint).await {
                    tracing::error!("create_market error: {e:#?}");
                }
            }
            Method::CreateMarketMulti => {
                if let Err(e) = create_market::handle_multi(item, ix, msg_keys_opt, &state.memo_program, &state.usdc_mint).await {
                    tracing::error!("create_market_multi error: {e:#?}");
                }
            }
            Method::PlaceBet => {
                if let Err(e) = place_bet::handle(item, ix, msg_keys_opt, &state.memo_program, &state.usdc_mint).await {
                    tracing::error!("place_bet error: {e:#?}");
                }
            }
            Method::ResolveMarket => {
                if let Err(e) = resolve_market::handle(item, ix, msg_keys_opt).await {
                    tracing::error!("resolve_market error: {e:#?}");
                }
            }
            Method::Claim => {
                if let Err(e) = claim::handle(item, ix, msg_keys_opt).await {
                    tracing::error!("claim error: {e:#?}");
                }
            }
            Method::Unknown => {}
        }
    }
    Ok(())
}