use anchor_client::solana_sdk::{pubkey::Pubkey};
use serde_json::Value;
use std::str::FromStr;
use anyhow::anyhow;

use crate::{
    usecases::webhooks::shared::{extract_sig, extract_slot, extract_fee_payer, accounts_str_and_idx},
    solana::anchor_client as anchor_client_,
	repo::market as market_repo,
	error::{AppError},
	state
};
const IXI_MARKET: usize       = 0;
const IXI_RESOLVER: usize     = 2;


pub async fn handle(
    item: &Value,
    this_ix: &Value,
    msg_keys_opt: Option<&[Value]>,
) -> Result<(), AppError> {
    tracing::info!("handle resolve_market");

    let state = state::global();

    let signature = extract_sig(item).unwrap_or("<no-sig>");
    let slot      = extract_slot(item).unwrap_or_default();
    let fee_payer = extract_fee_payer(item).unwrap_or("<no-fee-payer>");

    let (acc_str, _acc_idx) = accounts_str_and_idx(this_ix, msg_keys_opt);

    let market_pda = *acc_str.get(IXI_MARKET).unwrap_or(&"<unknown>");
    let resolver   = *acc_str.get(IXI_RESOLVER).unwrap_or(&fee_payer);

    let market_pubkey = Pubkey::from_str(market_pda)
        .map_err(|e| AppError::Other(anyhow!("Invalid market pubkey: {}", e)))?;

    let snap_onchain = anchor_client_::fetch_market_snapshot(state.anchor.clone(), market_pubkey)
        .await
        .map_err(AppError::Other)?;

    if !snap_onchain.settled {
        return Err(AppError::bad_request("on-chain market is not settled yet"));
    }

    let mv = market_repo::fetch_by_pda(&state.db.pool(), market_pda)
        .await
        .map_err(AppError::Other)?
        .ok_or_else(|| AppError::bad_request("market not found by market_pda"))?;
    let market_id = mv.id;

    let snap = market_repo::ResolveSnapshot {
        settled: snap_onchain.settled,
        winning_side: snap_onchain.winning_side,
        resolved_price_1e6: snap_onchain.resolved_price_1e6,
        payout_pool_1e6: snap_onchain.payout_pool_1e6,
        resolver_pubkey: resolver.to_string(),
        tx_sig_resolve: signature.to_string(),
    };

    let view = market_repo::confirm_resolve_persist(&state.db.pool(), market_id, &snap)
        .await
        .map_err(AppError::Other)?;

    tracing::info!(
        "resolve_market persisted: market_id={} pda={} resolver={} sig={} slot={} status={} winning_side={:?} price={} pool={}",
        view.market_id,
        market_pda,
        resolver,
        signature,
        slot,
        view.status,
        view.winning_side,
        view.resolved_price_1e6.unwrap_or(0),
        view.payout_pool_1e6.unwrap_or(0),
    );

    Ok(())
}