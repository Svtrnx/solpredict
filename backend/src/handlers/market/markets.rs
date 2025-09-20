// src/handlers/markets.rs
use axum::{extract::{Query, State}, Json, http::{StatusCode}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::repo::market as market_repo;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct MarketDto {
    id: Uuid,
    category: String,
    market_pda: String,
    title: String,
    totalVolume: f64,
    participants: i32,
    yesPrice: f64,
    noPrice: f64,
    endDate: String,
}

#[derive(Serialize)]
pub struct MarketsPageResponse {
    ok: bool,
    items: Vec<MarketDto>,
    nextCursor: Option<String>, // base64 "{updated_at}|{id}"
}

#[derive(Deserialize)]
pub struct MarketsQuery {
    limit: Option<u32>,          // default 15
    cursor: Option<String>,      // cursor for keyset
    category: Option<String>,    // filter by category
}

pub const DATETIME_QUESTION: &str = "%b %d, %Y UTC";

pub fn fmt_usd(amount: f64) -> String {
    if amount >= 1.0 {
        format!("{:.2}", amount)
    } else if amount >= 0.01 {
        format!("{:.4}", amount)
    } else {
        format!("{:.6}", amount)
    }
}

pub fn generate_title(m: &market_repo::MarketRowFetch) -> String {
    let symbol_trimmed = m.symbol.strip_prefix("Crypto.").unwrap_or(&m.symbol);
    let date_str = m.end_date_utc.format(DATETIME_QUESTION).to_string();

    match m.market_type.as_str() {
        "price-threshold" => {
            let thr = (m.bound_lo_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            let cmp_txt = match m.comparator.as_deref().unwrap_or(">") {
                ">"  => "greater than",
                "<"  => "less than",
                ">=" => "greater than or equal to",
                "<=" => "less than or equal to",
                "="  => "equal to",
                _    => "reach",
            };
            format!("Will {symbol_trimmed} be {cmp_txt} ${} by {date_str}?", fmt_usd(thr))
        }
        "price-range" => {
            let lo = (m.bound_lo_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            let hi = (m.bound_hi_1e6.unwrap_or(0) as f64) / 1_000_000.0;
            format!(
                "Will {symbol_trimmed} stay between ${} and ${} until {date_str}?",
                fmt_usd(lo),
                fmt_usd(hi)
            )
        }
        _ => symbol_trimmed.to_string(),
    }
}

pub async fn list_markets(
    State(state): State<SharedState>,
    Query(q): Query<MarketsQuery>,
) -> Result<Json<MarketsPageResponse>, (StatusCode, String)> {
    let limit = q.limit.unwrap_or(15).clamp(1, 100) as i64;

    let page = market_repo::fetch_markets_page(
        state.db.pool(),
        limit,
        q.cursor.as_deref(),
        q.category.as_deref(),
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    let items = page.items.into_iter().map(|m| MarketDto{
        id: m.id,
        title: generate_title(&m),
        market_pda: m.market_pda,
        category: m.category,
        totalVolume: (m.total_volume_1e6 as f64) / 1_000_000.0,
        participants: m.participants,
        yesPrice: (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        noPrice: 1.0 - (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        endDate: m.end_date_utc.to_rfc3339(),
    }).collect();

    Ok(Json(MarketsPageResponse{ ok: true, items, nextCursor: page.next_cursor }))
}
