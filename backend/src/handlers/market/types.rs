use jsonwebtoken::{DecodingKey, Validation, decode};
use anchor_client::solana_sdk::pubkey::Pubkey;
use validator::{Validate, ValidationError};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use axum::{http::HeaderMap};
use time::{OffsetDateTime};
use std::str::FromStr;

use crate::{
    error::AppError,
    repo::market::MarketRow
};

#[derive(Deserialize)]
pub struct Claims {
    pub sub: String,
    pub wallet: String,
    pub wallet_id: String,
    pub iat: usize,
    pub exp: usize,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MarketType {
    PriceThreshold,
    PriceRange,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub enum MarketCategory {
    #[serde(rename = "crypto")]
    Crypto,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub enum SeedSide {
    Yes,
    No,
}

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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub yes_price: f64,
    pub no_price: f64,
    pub total_volume: f64,
    pub participants: i32,
    pub liquidity: f64,
    pub end_date: String,
    pub category: String,
    pub creator: String,
    pub settler: Option<String>,
    pub status: MarketStatusDto,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketStatusDto {
    Open,
    Locked,
    Settled,
    Void,
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

pub struct TitleSpec {
    pub symbol: String,
    pub end_date_utc: DateTime<Utc>,
    pub market_type: Option<String>,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,
}

pub fn usd_to_1e6(x: f64) -> i64 {
    (x * 1_000_000f64).round() as i64
}

pub fn generate_title(s: &TitleSpec) -> String {
    let symbol_trimmed = s.symbol.strip_prefix("Crypto.").unwrap_or(&s.symbol);
    let date_str = s.end_date_utc.format("%b %d, %Y").to_string();

    match s.market_type.as_deref().unwrap_or("price-threshold") {
        "price-threshold" => {
            let thr = (s.bound_lo_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            let cmp_txt = match s.comparator.as_deref().unwrap_or(">") {
                ">" => "greater than",
                "<" => "less than",
                ">=" => "greater than or equal to",
                "<=" => "less than or equal to",
                "=" => "equal to",
                _ => "reach",
            };
            format!(
                "Will {symbol_trimmed} be {cmp_txt} ${:.2} by {date_str}?",
                thr
            )
        }
        "price-range" => {
            let lo = (s.bound_lo_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            let hi = (s.bound_hi_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            format!(
                "Will {symbol_trimmed} stay between ${:.2} and ${:.2} until {date_str}?",
                lo, hi
            )
        }
        _ => format!("Will {symbol_trimmed} reach the target by {date_str}?"),
    }
}

impl From<&MarketRow> for TitleSpec {
    fn from(r: &MarketRow) -> Self {
        TitleSpec {
            symbol: r.symbol.clone(),
            end_date_utc: r.end_date_utc,
            market_type: Some(r.market_type.clone()),
            comparator: r.comparator.clone(),
            bound_lo_1e6: r.bound_lo_1e6,
            bound_hi_1e6: r.bound_hi_1e6,
        }
    }
}

// ========== Mapping Row -> DTO ==========
impl From<MarketRow> for MarketDto {
    fn from(r: MarketRow) -> Self {
        let yes = r
            .price_yes_bp
            .map(|bp| (bp as f64) / 10_000.0)
            .unwrap_or(0.5);
        let no = (1.0 - yes).max(0.0);

        let pool_1e6 = r.initial_liquidity_1e6 + r.yes_total_1e6 + r.no_total_1e6;

        let status = match r.status.as_str() {
            "active" => MarketStatusDto::Open,
            "awaiting_resolve" => MarketStatusDto::Locked,
            "settled_yes" | "settled_no" => MarketStatusDto::Settled,
            "void" => MarketStatusDto::Void,
            _ => MarketStatusDto::Open,
        };

        // Gen title
        let title = generate_title(&TitleSpec::from(&r));
        let description = format!("Category: {}. PDA: {}.", r.category, r.market_pda);

        MarketDto {
            id: r.id.to_string(),
            title,
            description,
            yes_price: round2(yes),
            no_price: round2(no),
            total_volume: (r.total_volume_1e6 as f64) / 1_000_000.0,
            participants: r.participants,
            liquidity: (pool_1e6 as f64) / 1_000_000.0,
            end_date: r.end_date_utc.to_rfc3339(),
            category: r.category,
            creator: r.creator,
            settler: r.resolver_pubkey,
            status,
        }
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

pub fn current_user_pubkey(headers: &HeaderMap, jwt_secret: &str) -> Result<Pubkey, AppError> {
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

pub fn cat_str(_: MarketCategory) -> &'static str {
    "crypto"
}

pub fn cmp_str(c: Comparator) -> &'static str {
    match c {
        Comparator::Gte => ">=",
        Comparator::Gt => ">",
        Comparator::Lte => "<=",
        Comparator::Lt => "<",
        Comparator::Eq => "=",
        Comparator::Empty => "",
    }
}


pub fn feed_id_hex_to_bytes32(s: &str) -> anyhow::Result<[u8; 32]> {
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
pub fn resolve_price_feed_account_from_hex(feed_id_hex: &str) -> anyhow::Result<Pubkey> {
    let prog_str = std::env::var("PYTH_PUSH_ORACLE_ID")
        .map_err(|_| anyhow::anyhow!("Env PYTH_PUSH_ORACLE_ID is not set"))?;
    let pyth_program_id = Pubkey::from_str(&prog_str)
        .map_err(|_| anyhow::anyhow!("Invalid PYTH_PUSH_ORACLE_ID"))?;
    let shard_id: u16 = std::env::var("PYTH_SHARD_ID")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let feed_id = feed_id_hex_to_bytes32(feed_id_hex)?;
    let (price_account, _) =
        Pubkey::find_program_address(&[&shard_id.to_le_bytes(), &feed_id], &pyth_program_id);
    Ok(price_account)
}