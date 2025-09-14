use anchor_client::solana_sdk::pubkey::Pubkey;
use axum::{Json, extract::State, http::StatusCode};
use serde::Deserialize;
use serde_json::json;
use spl_associated_token_account::get_associated_token_address;
use std::str::FromStr;

use crate::{solana::anchor_client as acli, state::SharedState};

#[derive(Deserialize)]
pub struct AirdropReq {
    pub user: String,
}

// Endpoint: one-time USDC airdrop - devnet only
pub async fn usdc_airdrop_once(
    State(_app): State<SharedState>,
    Json(req): Json<AirdropReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Parse user pubkey from request
    let user = Pubkey::from_str(&req.user)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("bad pubkey: {e}")))?;

    // Run anchor-client logic inside blocking task
    let res = tokio::task::spawn_blocking(move || -> anyhow::Result<(String, Pubkey, Pubkey)> {
        let ctx = acli::connect_devnet()?; 
        let sig = acli::airdrop_usdc_once(&ctx, user)?;
        let mint = Pubkey::from_str("5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh")?;
        let ata = get_associated_token_address(&user, &mint);
        Ok((sig.to_string(), mint, ata))
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("join error: {e}"),
        )
    })?;

    // Map on-chain errors
    let (tx, mint, ata) = res.map_err(|e| {
        let es = e.to_string();
        if es.contains("Airdrop already claimed") {
            (StatusCode::CONFLICT, "already claimed".into())
        } else if es.contains("Wrong mint") {
            (StatusCode::BAD_REQUEST, "wrong mint".into())
        } else if es.contains("insufficient funds") {
            (
                StatusCode::PAYMENT_REQUIRED,
                "insufficient devnet SOL on payer".into(),
            )
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, es)
        }
    })?;

    Ok(Json(
        json!({
            "ok": true,
            "tx": tx,
            "user": user.to_string(),
            "mint": mint.to_string(),
            "ata": ata.to_string()
        }),
    ))
}
