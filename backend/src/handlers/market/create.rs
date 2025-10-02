use axum::{Json, extract::State, http::HeaderMap, http::StatusCode};
use serde::{Serialize};
use time::{Duration, OffsetDateTime};
use validator::Validate;

use crate::{
    error::AppError,
    handlers::market::types::{Comparator, CreateMarketRequest, MarketType, SeedSide, current_user_pubkey},
    solana::anchor_client as anchor_client_,
    state::SharedState,
};

use anchor_client::solana_sdk::pubkey::Pubkey;
use prediction_market_program as onchain;

// Map comparator enum into u8 for on-chain representation
fn map_comparator(c: Comparator) -> u8 {
    match c {
        Comparator::Gt => 0,
        Comparator::Lt => 1,
        Comparator::Gte => 2,
        Comparator::Lte => 3,
        // Eq/Empty not supported on-chain
        _ => 0,
    }
}

fn feed_id_hex_to_bytes32(s: &str) -> anyhow::Result<[u8; 32]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let raw = hex::decode(s)?;
    if raw.len() != 32 {
        anyhow::bail!("feedId must be 32 bytes (64 hex chars)");
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&raw);
    Ok(out)
}

// Convert USD float -> int with 1e6 precision
fn usd_to_1e6(x: f64) -> i64 {
    (x * 1_000_000f64).round() as i64
}

// ----- RESPONSE -----
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMarketResponse {
    pub ok: bool,
    pub market_id: String,
    pub create_tx: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub place_bet_tx: Option<String>,
    pub message: String,
}

// Main entrypoint: build and return transaction for creating market
pub async fn create_market(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<CreateMarketRequest>,
) -> Result<(StatusCode, Json<CreateMarketResponse>), AppError> {
    // Authorization: extract user wallet from cookie
    let user_pubkey = current_user_pubkey(&headers, &state.jwt_secret)?;

    // Validate request
    req.validate()?;
    if req.end_date <= OffsetDateTime::now_utc() + Duration::minutes(10) {
        return Err(AppError::bad_request(
            "End date must be at least 10 minutes in the future",
        ));
    }

    // Map request into on-chain formats
    let market_type_onchain = match req.market_type {
        MarketType::PriceThreshold => onchain::MarketType::PriceThreshold,
        MarketType::PriceRange => onchain::MarketType::PriceRange,
    };
    let comparator_u8 = map_comparator(req.comparator);

    let (bound_lo_usd_6, bound_hi_usd_6) = match req.market_type {
        MarketType::PriceThreshold => {
            let t = req
                .threshold
                .ok_or_else(|| AppError::bad_request("threshold is required"))?;
            (usd_to_1e6(t), 0)
        }
        MarketType::PriceRange => {
            let lo = req
                .lower_bound
                .ok_or_else(|| AppError::bad_request("lowerBound is required"))?;
            let hi = req
                .upper_bound
                .ok_or_else(|| AppError::bad_request("upperBound is required"))?;
            (usd_to_1e6(lo), usd_to_1e6(hi))
        }
    };

    // Resolve Pyth price account
    let feed_id_bytes = feed_id_hex_to_bytes32(&req.feed_id)
        .map_err(|e| AppError::bad_request(&format!("bad feedId hex: {e}")))?;

    // Build transaction (create + seed market)
    let ctx = state.anchor.clone();
    let end_ts = req.end_date.unix_timestamp();
    let amount_tokens: u64 = (req.initial_liquidity * 1_000_000.0).round() as u64;

    let side_onchain = match req.initial_side {
        SeedSide::Yes => onchain::Side::Yes,
        SeedSide::No => onchain::Side::No,
    };

    let create_tx_b64 = tokio::task::spawn_blocking({
        let ctx = ctx.clone();
        move || {
            anchor_client_::build_create_and_seed(
                &ctx,
                user_pubkey,
                feed_id_bytes,
                market_type_onchain,
                comparator_u8,
                bound_lo_usd_6,
                bound_hi_usd_6,
                end_ts,
                side_onchain,
                amount_tokens,
            )
        }
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("Join error: {e}")))??;

    // Derive market PDA (based on user + feed + end_ts)
    let (market_pda, _) = Pubkey::find_program_address(
        &[
            b"market",
            user_pubkey.as_ref(),
            &feed_id_bytes,
            &end_ts.to_le_bytes(),
        ],
        &onchain::ID,
    );

    // Do not insert into DB here — wait for confirmation endpoint
    Ok((
        StatusCode::CREATED,
        Json(CreateMarketResponse {
            ok: true,
            market_id: market_pda.to_string(),
            create_tx: create_tx_b64,
            place_bet_tx: None,
            message: "Market created; optional initial liquidity included".into(),
        }),
    ))
}
