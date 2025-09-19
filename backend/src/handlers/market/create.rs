use axum::{Json, extract::State, http::HeaderMap, http::StatusCode};
use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};
use validator::{Validate, ValidationError};

use crate::error::AppError;
use crate::state::SharedState;

use anchor_client::solana_sdk::pubkey::Pubkey;
use jsonwebtoken::{DecodingKey, Validation, decode};
use prediction_market_program as onchain;

use crate::solana::anchor_client as anchor_client_;

#[derive(Deserialize)]
struct Claims {
    sub: String,
    wallet: String,
    wallet_id: String,
    iat: usize,
    exp: usize,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
pub enum SeedSide {
    Yes,
    No,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MarketType {
    PriceThreshold,
    PriceRange,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
pub enum MarketCategory {
    #[serde(rename = "crypto")]
    Crypto,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
pub enum Comparator {
    #[serde(rename = ">=")]
    Gte,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = "<=")]
    Lte,
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = "=")]
    Eq,
    #[serde(rename = "")]
    Empty,
}

// ----- REQUEST -----
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
#[validate(schema(function = "validate_market_fields"))]
pub struct CreateMarketRequest {
    pub market_type: MarketType,
    pub category: MarketCategory,

    #[serde(with = "time::serde::rfc3339")]
    pub end_date: OffsetDateTime,

    #[validate(range(min = 1.0, message = "Minimum liquidity is 1 unit"))]
    pub initial_liquidity: f64,

    pub initial_side: SeedSide,

    pub feed_id: String,

    #[validate(length(max = 128, message = "Too long value"))]
    pub symbol: String,

    pub comparator: Comparator,

    pub threshold: Option<f64>,
    pub lower_bound: Option<f64>,
    pub upper_bound: Option<f64>,
}

// Extra validation for request fields depending on market type
fn validate_market_fields(req: &CreateMarketRequest) -> Result<(), ValidationError> {
    match req.market_type {
        MarketType::PriceThreshold => {
            if req.threshold.is_none() {
                return Err(ValidationError::new("threshold_required"));
            }
        }
        MarketType::PriceRange => {
            let (Some(lo), Some(hi)) = (req.lower_bound, req.upper_bound) else {
                return Err(ValidationError::new("both_bounds_required"));
            };
            if lo >= hi {
                return Err(ValidationError::new(
                    "lower_bound_must_be_less_than_upper_bound",
                ));
            }
        }
    }

    // Feed ID must be valid 64-char hex string
    let s = req.feed_id.trim_start_matches("0x");
    if s.len() != 64 || !s.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ValidationError::new("feed_id_must_be_64_hex"));
    }

    Ok(())
}

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

use std::str::FromStr;

// Helper: hex feed id -> [u8;32]
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

// Extract user wallet pubkey from sp_session cookie
fn current_user_pubkey(headers: &HeaderMap, jwt_secret: &str) -> Result<Pubkey, AppError> {
    let cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::unauthorized("missing cookie"))?;

    let sess = cookie
        .split(';')
        .map(|s| s.trim())
        .find_map(|kv| kv.strip_prefix("sp_session="))
        .ok_or_else(|| AppError::unauthorized("missing sp_session"))?;

    let token = sess.to_string();

    let data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::unauthorized("invalid session"))?;

    Pubkey::from_str(&data.claims.wallet)
        .map_err(|_| AppError::bad_request("bad wallet pubkey in session"))
}

// Resolve Pyth price feed Pubkey from feedId hex
fn resolve_price_feed_account_from_hex(feed_id_hex: &str) -> anyhow::Result<Pubkey> {
    let prog_str = std::env::var("PYTH_PUSH_ORACLE_ID")
        .map_err(|_| anyhow::anyhow!("Env PYTH_PUSH_ORACLE_ID is not set"))?;
    let pyth_program_id =
        Pubkey::from_str(&prog_str).map_err(|_| anyhow::anyhow!("Invalid PYTH_PUSH_ORACLE_ID"))?;

    let shard_id: u16 = std::env::var("PYTH_SHARD_ID")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(0);

    let feed_id = feed_id_hex_to_bytes32(feed_id_hex)?;

    let (price_account, _bump) =
        Pubkey::find_program_address(&[&shard_id.to_le_bytes(), &feed_id], &pyth_program_id);

    Ok(price_account)
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
    let price_feed_pubkey: Pubkey = resolve_price_feed_account_from_hex(&req.feed_id)
        .map_err(|e| AppError::bad_request(&format!("Cannot resolve price account: {e}")))?;

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
                price_feed_pubkey,
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
            price_feed_pubkey.as_ref(),
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
