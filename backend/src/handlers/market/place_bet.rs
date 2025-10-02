use axum::{
    Json,
    extract::{Extension, State},
    http::StatusCode,
};
use serde::{Deserialize, Deserializer, Serialize};
use validator::Validate;

use crate::{
    error::AppError, middleware::auth::CurrentUser, repo::market as market_repo,
    solana::anchor_client as anchor_client_, state::SharedState, usecases::bets,
};
use anchor_client::solana_sdk::pubkey::Pubkey;
use anyhow::anyhow;
use std::str::FromStr;

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

#[derive(Debug, serde::Deserialize, Validate)]
pub struct ConfirmPlaceBetRequest {
    #[validate(length(min = 32, max = 64))]
    pub market_pda: String,

    #[serde(deserialize_with = "de_side")]
    pub side: Side,

    #[validate(range(min = 0.000001))]
    pub amount_ui: f64,

    #[validate(length(min = 80, max = 120))]
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct PreparePlaceBetResponse {
    pub ok: bool,
    pub tx_base64: String, // unsigned Transaction
}

#[derive(Debug, Serialize)]
pub struct ConfirmPlaceBetResponse {
    pub ok: bool,
}

#[axum::debug_handler]
pub async fn prepare_place_bet(
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

    let recent_blockhash = state
        .rpc
        .get_latest_blockhash()
        .await
        .map_err(|e| AppError::Other(anyhow!(e)))?;

    let mut tx =
        anchor_client::solana_sdk::transaction::Transaction::new_with_payer(&ixs, Some(&user_pk));
    tx.message.recent_blockhash = recent_blockhash;

    let tx_b64 = anchor_client_::encode_unsigned_tx(&tx).map_err(AppError::Other)?;
    tracing::info!("5");

    Ok(Json(PreparePlaceBetResponse {
        ok: true,
        tx_base64: tx_b64,
    }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Confirm: verify the signature and record the bet + upsert position + points
// ──────────────────────────────────────────────────────────────────────────────

#[axum::debug_handler]
pub async fn confirm_place_bet(
    State(state): State<SharedState>,
    Extension(user): Extension<CurrentUser>,
    Json(req): Json<ConfirmPlaceBetRequest>,
) -> Result<(StatusCode, Json<ConfirmPlaceBetResponse>), AppError> {
    let amount_1e6 = amount_ui_to_1e6(req.amount_ui)?;

    anchor_client_::wait_for_confirmation(&req.signature, &state.rpc)
        .await
        .map_err(|e| AppError::bad_request(&format!("tx not confirmed: {e}")))?;

    let Some(m) = market_repo::fetch_by_pda(state.db.pool(), &req.market_pda)
        .await
        .map_err(AppError::Other)?
    else {
        return Err(AppError::NotFound);
    };

    bets::record_bet_and_points(
        state.db.pool(),
        m.id,
        &user.wallet,
        req.side.yes(),
        amount_1e6 as i64,
        &req.signature,
    )
    .await
    .map_err(AppError::Other)?;

    // let bet_id = bet_id_opt.ok_or_else(|| AppError::bad_request("bet not created"))?;

    Ok((
        StatusCode::OK,
        Json(ConfirmPlaceBetResponse { ok: true }),
    ))
}
