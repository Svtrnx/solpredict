use anchor_client::solana_sdk::pubkey::Pubkey;
use serde_json::Value;
use std::str::FromStr;
use anyhow::anyhow;

use crate::{
    usecases::webhooks::shared::{extract_sig, extract_fee_payer, accounts_str_and_idx},
    solana as anchor_client_,
    repo::bets as bets_repo,
    error::AppError,
    state,
};

const IXI_USER:   usize = 0;
const IXI_MARKET: usize = 1;

pub async fn handle(
    item: &Value,
    this_ix: &Value,
    msg_keys_opt: Option<&[Value]>,
) -> Result<(), AppError> {
    tracing::info!("handle claim");
    let state = state::global();

    let signature = extract_sig(item).unwrap_or("<no-sig>");
    let fee_payer = extract_fee_payer(item).unwrap_or("<no-fee-payer>");
    let (acc_str, _acc_idx) = accounts_str_and_idx(this_ix, msg_keys_opt);

    let user_str       = *acc_str.get(IXI_USER).unwrap_or(&fee_payer);
    let market_pda_str = *acc_str.get(IXI_MARKET).unwrap_or(&"<unknown>");

    let user_pk = Pubkey::from_str(user_str)
        .map_err(|e| AppError::bad_request(format!("invalid user pubkey: {e}")))?;
    let market_pda = Pubkey::from_str(market_pda_str)
        .map_err(|e| AppError::bad_request(format!("invalid market pubkey: {e}")))?;

    let m_snap = anchor_client_::fetch_market_snapshot(state.anchor.clone(), market_pda)
        .await
        .map_err(AppError::Other)?;
    if !m_snap.settled {
        tracing::warn!("claim webhook before market settled; market={}", market_pda_str);
        return Ok(());
    }

    let ctx = state.anchor.clone();
    let pos_res = tokio::task::spawn_blocking(move || {
        anchor_client_::get_position_account(&ctx, market_pda, user_pk)
    })
    .await
    .map_err(|e| AppError::Other(anyhow!("join error: {e}")))?;

    let pos = match pos_res {
        Ok(p) => p,
        Err(err) => {
            tracing::warn!(
                "position account not readable yet: market={} user={} err={err}",
                market_pda_str, user_str
            );
            return Ok(());
        }
    };

    if pos.market != market_pda || pos.user != user_pk {
        tracing::warn!(
            "position mismatch: pos.market={}, pos.user={}, expected market={}, user={}",
            pos.market, pos.user, market_pda, user_pk
        );
        return Ok(());
    }

    if pos.claimed {
        bets_repo::mark_position_claimed_by_pda(
            &state.db.pool(),
            market_pda_str,
            user_str,
            signature,
        )
        .await
        .map_err(AppError::Other)?;

        tracing::info!(
            "position claimed recorded in DB: market={} user={} sig={}",
            market_pda_str, user_str, signature
        );
    } else {
        tracing::info!(
            "claim seen but on-chain position.claimed=false; market={} user={}",
            market_pda_str, user_str
        );
    }

    Ok(())
}
