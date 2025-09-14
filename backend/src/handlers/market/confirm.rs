use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use validator::Validate;

use crate::error::AppError;
use crate::handlers::market::create::{Comparator, CreateMarketRequest, MarketType};
use crate::repo::market as market_repo;
use crate::state::SharedState;

use anchor_client::solana_sdk::pubkey::Pubkey;
use prediction_market_program as onchain;
use std::str::FromStr;

// ==== helpers ====

// Extract current user pubkey from session cookie (JWT inside sp_session)
fn current_user_pubkey(headers: &HeaderMap, jwt_secret: &str) -> Result<Pubkey, AppError> {
    use jsonwebtoken::{DecodingKey, Validation, decode};
    #[derive(Deserialize)]
    struct Claims {
        wallet: String,
    }
    let cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::unauthorized("missing cookie"))?;
    let sess = cookie
        .split(';')
        .map(|s| s.trim())
        .find_map(|kv| kv.strip_prefix("sp_session="))
        .ok_or_else(|| AppError::unauthorized("missing sp_session"))?;
    let data = decode::<Claims>(
        &sess,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::unauthorized("invalid session"))?;
    Pubkey::from_str(&data.claims.wallet)
        .map_err(|_| AppError::bad_request("bad wallet pubkey in session"))
}

// Convert hex string into 32-byte array
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

// Derive Pyth price feed account from feedId and shard
fn resolve_price_feed_account_from_hex(feed_id_hex: &str) -> anyhow::Result<Pubkey> {
    use anchor_client::solana_sdk::pubkey::Pubkey as SDKPubkey;
    let prog_str = std::env::var("PYTH_PUSH_ORACLE_ID")
        .map_err(|_| anyhow::anyhow!("Env PYTH_PUSH_ORACLE_ID is not set"))?;
    let pyth_program_id = SDKPubkey::from_str(&prog_str)
        .map_err(|_| anyhow::anyhow!("Invalid PYTH_PUSH_ORACLE_ID"))?;
    let shard_id: u16 = std::env::var("PYTH_SHARD_ID")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let feed_id = feed_id_hex_to_bytes32(feed_id_hex)?;
    let (price_account, _) =
        SDKPubkey::find_program_address(&[&shard_id.to_le_bytes(), &feed_id], &pyth_program_id);
    Ok(price_account)
}

// Convert USD float into integer with 1e6 precision
fn usd_to_1e6(x: f64) -> i64 {
    (x * 1_000_000f64).round() as i64
}

// Map comparator enum into numeric code for on-chain struct
fn map_comparator(c: Comparator) -> u8 {
    match c {
        Comparator::Gt => 0,
        Comparator::Lt => 1,
        Comparator::Gte => 2,
        Comparator::Lte => 3,
        _ => 0,
    }
}
// ========================================

#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmRequest {
    #[validate(nested)]
    pub create: CreateMarketRequest,
    #[validate(length(min = 1))]
    pub tx_sig: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmResponse {
    ok: bool,
    market_id: String,
}

pub async fn confirm_market(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<ConfirmRequest>,
) -> Result<(StatusCode, Json<ConfirmResponse>), AppError> {
    // 1) Validate input (reuses rules from create.rs)
    req.validate()?;

    // 2) Identify user from session cookie
    let user_pubkey = current_user_pubkey(&headers, &state.jwt_secret)?;

    // 3) Derive expected market PDA and parameters from request
    let price_feed_pubkey = resolve_price_feed_account_from_hex(&req.create.feed_id)
        .map_err(|e| AppError::bad_request(&format!("Cannot resolve price account: {e}")))?;
    let end_ts = req.create.end_date.unix_timestamp();

    let (market_pda, _) = Pubkey::find_program_address(
        &[
            b"market",
            user_pubkey.as_ref(),
            price_feed_pubkey.as_ref(),
            &end_ts.to_le_bytes(),
        ],
        &onchain::ID,
    );
    let market_pda_str = market_pda.to_string();

    // Expected values for validation
    let expected_market_type_u8 = match req.create.market_type {
        MarketType::PriceThreshold => 0u8,
        MarketType::PriceRange => 1u8,
    };
    let expected_comparator = map_comparator(req.create.comparator);
    let (exp_lo, exp_hi) = match req.create.market_type {
        MarketType::PriceThreshold => {
            let t = req
                .create
                .threshold
                .ok_or_else(|| AppError::bad_request("threshold is required"))?;
            (usd_to_1e6(t), 0)
        }
        MarketType::PriceRange => {
            let lo = req
                .create
                .lower_bound
                .ok_or_else(|| AppError::bad_request("lowerBound is required"))?;
            let hi = req
                .create
                .upper_bound
                .ok_or_else(|| AppError::bad_request("upperBound is required"))?;
            (usd_to_1e6(lo), usd_to_1e6(hi))
        }
    };

    // 4) Fetch market account from on-chain program
    let ctx = state.anchor.clone();
    let onchain_market = tokio::task::spawn_blocking(move || {
        let program = ctx.client.program(ctx.program_id)?;
        let acc = program
            .account::<onchain::Market>(market_pda)
            .map_err(|e| anyhow::anyhow!("market account fetch failed: {e}"))?;
        anyhow::Ok(acc)
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("Join error: {e}")))??;

    // 5) Verify critical fields against on-chain data
    if onchain_market.authority != user_pubkey {
        return Err(AppError::bad_request(
            "authority mismatch with on-chain market",
        ));
    }
    if onchain_market.feed != price_feed_pubkey {
        return Err(AppError::bad_request(
            "price feed mismatch with on-chain market",
        ));
    }
    if onchain_market.end_ts != end_ts {
        return Err(AppError::bad_request(
            "end_ts mismatch with on-chain market",
        ));
    }
    if onchain_market.market_type != expected_market_type_u8 {
        return Err(AppError::bad_request(
            "market_type mismatch with on-chain market",
        ));
    }
    if onchain_market.comparator != expected_comparator {
        return Err(AppError::bad_request(
            "comparator mismatch with on-chain market",
        ));
    }
    if onchain_market.bound_lo != exp_lo || onchain_market.bound_hi != exp_hi {
        return Err(AppError::bad_request(
            "bounds/threshold mismatch with on-chain market",
        ));
    }

    // 6) Save confirmed market into DB
    let settled = false;
    let authority_b58 = user_pubkey.to_string();

    market_repo::insert_confirmed(
        state.db.pool(),
        &req.create,
        &market_pda_str,
        &authority_b58,
        &req.tx_sig,
        settled,
    )
    .await
    .map_err(AppError::Other)?;

    Ok((
        StatusCode::OK,
        Json(ConfirmResponse {
            ok: true,
            market_id: market_pda_str,
        }),
    ))
}
