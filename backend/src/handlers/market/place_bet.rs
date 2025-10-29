use serde::{Deserialize, Serialize};
use spl_memo::{build_memo};
use validator::Validate;
use std::str::FromStr;
use anyhow::anyhow;

use axum::{
    extract::{Extension, State},
    Json,
};
use anchor_client::solana_sdk::{
    transaction::Transaction,
    pubkey::Pubkey, 
};

use crate::{
    error::AppError, middleware::auth::CurrentUser,
    solana as anchor_client_, state::SharedState
};


const OUTCOME_YES: u8 = 0;
const OUTCOME_NO:  u8 = 1;


#[inline]
fn side_yes_from_outcome_idx(idx: u8) -> Result<bool, AppError> {
    match idx {
        OUTCOME_YES => Ok(true),   // YES
        OUTCOME_NO  => Ok(false),  // NO
        _ => Err(AppError::bad_request("binary market expects outcome_idx 0 (YES) or 1 (NO)")),
    }
}

fn amount_ui_to_1e6(x: f64) -> Result<u64, AppError> {
    if !x.is_finite() || x <= 0.0 {
        return Err(AppError::bad_request("amount_ui must be > 0"));
    }
    Ok((x * 1_000_000.0).round() as u64)
}

#[derive(Debug, Deserialize, Validate)]
pub struct PreparePlaceBetRequest {
    #[validate(length(min = 32, max = 64))]
    pub market_pda: String,
    pub outcome_idx: u8,   // binary: 0=YES, 1=NO; multi: 0..num_outcomes-1
    #[validate(range(min = 0.000001))]
    pub amount_ui: f64,
}


#[derive(Debug, Serialize)]
pub struct PreparePlaceBetResponse {
    pub ok: bool,
    pub tx_base64: String, // unsigned Transaction
}


// ====== POST /v1/markets/bets/tx ======

pub async fn prepare_place_tx(
    State(state): State<SharedState>,
    Extension(user): Extension<CurrentUser>,
    Json(req): Json<PreparePlaceBetRequest>,
) -> Result<Json<PreparePlaceBetResponse>, AppError> {
    let user_pk =
        Pubkey::from_str(&user.wallet).map_err(|_| AppError::bad_request("bad user wallet"))?;
    let market_pk =
        Pubkey::from_str(&req.market_pda).map_err(|_| AppError::bad_request("bad market pda"))?;
    let amount_1e6 = amount_ui_to_1e6(req.amount_ui)?;

    let market = anchor_client_::fetch_market_account(state.anchor.clone(), market_pk)
        .await
        .map_err(AppError::Other)?;

    // Validate market is active and not settled
    let now_ts = chrono::Utc::now().timestamp();
    if now_ts >= market.end_ts {
        return Err(AppError::bad_request("market already ended"));
    }
    if market.settled {
        return Err(AppError::bad_request("market already settled"));
    }

    // For binary markets, validate outcome_idx is 0 or 1
    if req.outcome_idx > 1 {
        return Err(AppError::bad_request("binary market expects outcome_idx 0 (YES) or 1 (NO)"));
    }

    let side_yes = side_yes_from_outcome_idx(req.outcome_idx)?; // 0=>YES, 1=>NO

    tracing::info!("side_yes: {}", side_yes);

    let ctx = state.anchor.clone();
    let ixs = tokio::task::spawn_blocking(move || {
        anchor_client_::build_place_bet_ixs(&ctx, user_pk, market_pk, side_yes, amount_1e6)
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("join error: {e}")))??;

    let side_str = if side_yes { "yes" } else { "no" };
    let memo_str = format!("v=1&t=place_bet&s={}", side_str);
    let memo_ix = build_memo(memo_str.as_bytes(), &[]);

    let mut all_ixs = ixs;
    all_ixs.push(memo_ix);

    let recent_blockhash = state
        .rpc
        .get_latest_blockhash()
        .await
        .map_err(|e| AppError::Other(anyhow!(e)))?;
    tracing::info!("recent_blockhash = {recent_blockhash}");

    let mut tx = Transaction::new_with_payer(&all_ixs, Some(&user_pk));
    tx.message.recent_blockhash = recent_blockhash;

    let tx_b64 = anchor_client_::encode_unsigned_tx(&tx).map_err(AppError::Other)?;
    Ok(Json(PreparePlaceBetResponse { ok: true, tx_base64: tx_b64 }))
}


// ====== POST /v1/markets/ai/bets/tx ======

#[axum::debug_handler]
pub async fn build_place_bet_multi_tx(
    State(state): State<SharedState>,
    Extension(user): Extension<CurrentUser>,
    Json(req): Json<PreparePlaceBetRequest>,
) -> Result<Json<PreparePlaceBetResponse>, AppError> {
    use std::str::FromStr;
    use anchor_client::solana_sdk::pubkey::Pubkey;

    let user_pk  = Pubkey::from_str(&user.wallet).map_err(|_| AppError::bad_request("bad user wallet"))?;
    let market_pk= Pubkey::from_str(&req.market_pda).map_err(|_| AppError::bad_request("bad market pda"))?;
    if !req.amount_ui.is_finite() || req.amount_ui <= 0.0 {
        return Err(AppError::bad_request("amount_ui must be > 0"));
    }
    let amount_1e6 = (req.amount_ui * 1_000_000.0).round() as u64;

    let market = anchor_client_::fetch_market_account(state.anchor.clone(), market_pk)
        .await
        .map_err(AppError::Other)?;

    if (req.outcome_idx as u32) >= (market.num_outcomes as u32) {
        return Err(AppError::bad_request(format!(
            "outcome_idx {} out of range (num_outcomes={})",
            req.outcome_idx, market.num_outcomes
        )));
    }

    let now_ts = chrono::Utc::now().timestamp();
    if now_ts >= market.end_ts {
        return Err(AppError::bad_request("market already ended"));
    }
    if market.settled {
        return Err(AppError::bad_request("market already settled"));
    }

    let mut ixs = tokio::task::spawn_blocking({
        let ctx = state.anchor.clone();
        let u   = user_pk;
        let m   = market_pk;
        let idx = req.outcome_idx;
        move || anchor_client_::build_place_bet_multi_ixs(&ctx, u, m, idx, amount_1e6)
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("join error: {e}")))??;

    ixs.push(spl_memo::build_memo(
        format!("v=1&t=place_bet_multi&o={}", req.outcome_idx).as_bytes(),
        &[],
    ));

    // unsigned tx
    let recent_blockhash = state.rpc.get_latest_blockhash().await.map_err(|e| AppError::Other(anyhow!(e)))?;
    let mut tx = anchor_client::solana_sdk::transaction::Transaction::new_with_payer(&ixs, Some(&user_pk));
    tx.message.recent_blockhash = recent_blockhash;

    let tx_b64 = anchor_client_::encode_unsigned_tx(&tx).map_err(AppError::Other)?;
    Ok(Json(PreparePlaceBetResponse { ok: true, tx_base64: tx_b64 }))
}