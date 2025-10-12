use serde::{Deserialize, Deserializer, Serialize};
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
    error::AppError, middleware::auth::CurrentUser, repo::market as market_repo,
    solana::anchor_client as anchor_client_, state::SharedState
};


#[derive(Debug, Clone, Copy)]
pub enum Side {
    Yes,
    No,
}

impl Side {
    #[inline]
    pub fn yes(self) -> bool {
        matches!(self, Side::Yes)
    }
}

fn de_side<'de, D>(d: D) -> Result<Side, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(d)?;
    match s.to_ascii_lowercase().as_str() {
        "yes" => Ok(Side::Yes),
        "no" => Ok(Side::No),
        _ => Err(serde::de::Error::custom("expected \"yes\" or \"no\"")),
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

    #[serde(deserialize_with = "de_side")]
    pub side: Side,

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
    let side_yes = req.side.yes();

    let Some(m) = market_repo::fetch_by_pda(state.db.pool(), &req.market_pda)
        .await
        .map_err(AppError::Other)?
    else {
        return Err(AppError::NotFound);
    };
    if m.status != "active" {
        return Err(AppError::bad_request("market is not open"));
    }
    if let Some(end) = m.end_date_utc {
        if end <= chrono::Utc::now() {
            return Err(AppError::bad_request("market already ended"));
        }
    }

    let ctx = state.anchor.clone();

    let ixs = tokio::task::spawn_blocking(move || {
        anchor_client_::build_place_bet_ixs(&ctx, user_pk, market_pk, side_yes, amount_1e6)
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("join error: {e}")))??;

    let side = if side_yes { "yes" } else { "no" };
    let memo_str = format!("v=1&t=place_bet&s={}", side);
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
    Ok(Json(PreparePlaceBetResponse {
        ok: true,
        tx_base64: tx_b64,
    }))
}
