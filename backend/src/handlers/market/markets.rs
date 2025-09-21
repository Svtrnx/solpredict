use axum::{extract::{Query, State}, Json, http::{StatusCode}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    repo::market as market_repo,
    state::SharedState,
    handlers::market::types::{generate_title, TitleSpec}
};


impl From<&market_repo::MarketRowFetch> for TitleSpec {
    fn from(r: &market_repo::MarketRowFetch) -> Self {
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

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct MarketDto {
    id: Uuid,
    category: String,
    market_pda: String,
    title: String,
    total_volume: f64,
    participants: i32,
    yes_price: f64,
    no_price: f64,
    end_date: String,
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct MarketsPageResponse {
    ok: bool,
    items: Vec<MarketDto>,
    next_cursor: Option<String>, // base64 "{updated_at}|{id}"
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


pub async fn list(
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
        title: generate_title(&TitleSpec::from(&m)),
        market_pda: m.market_pda,
        category: m.category,
        total_volume: (m.total_volume_1e6 as f64) / 1_000_000.0,
        participants: m.participants,
        yes_price: (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        no_price: 1.0 - (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        end_date: m.end_date_utc.to_rfc3339(),
    }).collect();

    Ok(Json(MarketsPageResponse{ ok: true, items, next_cursor: page.next_cursor }))
}
