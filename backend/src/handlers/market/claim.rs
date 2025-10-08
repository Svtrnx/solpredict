use anchor_client::solana_sdk::pubkey::Pubkey;
use axum::extract::{Extension, Json, State};
use serde::{Deserialize, Serialize};
use validator::Validate;
use std::str::FromStr;
use anyhow::anyhow;


use crate::{
	error::AppError, middleware::auth::CurrentUser, 
	repo::market as market_repo, solana::anchor_client as anchor_client_, 
	state::SharedState
};

#[derive(Debug, Deserialize, Validate)]
pub struct PrepareClaimRequest {
    #[validate(length(min = 32, max = 64))]
    pub market_pda: String,
}

#[derive(Debug, Serialize)]
pub struct PrepareClaimResponse {
    pub ok: bool,
    pub tx_base64: String, // unsigned Transaction
}

// ====== POST /v1/markets/claim/tx ======

pub async fn prepare_claim_tx(
    State(state): State<SharedState>,
    Extension(user): Extension<CurrentUser>,
    Json(req): Json<PrepareClaimRequest>,
) -> Result<Json<PrepareClaimResponse>, AppError> {
    let user_pk =
        Pubkey::from_str(&user.wallet).map_err(|_| AppError::bad_request("bad user wallet"))?;
    let market_pk =
        Pubkey::from_str(&req.market_pda).map_err(|_| AppError::bad_request("bad market pda"))?;

    let Some(m_row) = market_repo::fetch_by_pda(state.db.pool(), &req.market_pda)
        .await
        .map_err(AppError::Other)?
    else {
        return Err(AppError::NotFound);
    };

    if matches!(m_row.status.as_str(), "active" | "awaiting_resolve") {
        return Err(AppError::bad_request("market is not resolved yet"));
    }

    let ctx = state.anchor.clone();
    let (on_mkt, on_pos, tx_b64) = tokio::task::spawn_blocking(move || -> anyhow::Result<_> {
        let m = anchor_client_::get_market_account(&ctx, market_pk)?;
        let p = anchor_client_::get_position_account(&ctx, market_pk, user_pk)?;
        let tx = anchor_client_::build_claim_ix(&ctx, user_pk, market_pk)?;
        Ok((m, p, tx))
    })
    .await
    .map_err(|e| AppError::Other(anyhow!("join error: {e}")))?
    .map_err(|e| AppError::Other(anyhow!(e)))?;

    if !on_mkt.settled {
        return Err(AppError::bad_request("market is not settled on-chain"));
    }
    if on_pos.claimed {
        return Err(AppError::bad_request("position already claimed"));
    }

    match on_mkt.winning_side {
        3 => {
            if on_pos.yes_bet == 0 && on_pos.no_bet == 0 {
                return Err(AppError::bad_request("nothing to refund for VOID"));
            }
        }
        1 => {
            if on_pos.yes_bet == 0 {
                return Err(AppError::bad_request("no winning YES bet to claim"));
            }
            if on_mkt.payout_pool == 0 {
                return Err(AppError::bad_request("payout pool is zero"));
            }
        }
        2 => {
            if on_pos.no_bet == 0 {
                return Err(AppError::bad_request("no winning NO bet to claim"));
            }
            if on_mkt.payout_pool == 0 {
                return Err(AppError::bad_request("payout pool is zero"));
            }
        }
        _ => return Err(AppError::bad_request("winning side is undefined")),
    }

    Ok(Json(PrepareClaimResponse {
        ok: true,
        tx_base64: tx_b64,
    }))
}
