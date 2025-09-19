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
        category: m.category,
        totalVolume: (m.total_volume_1e6 as f64) / 1_000_000.0,
        participants: m.participants,
        yesPrice: (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        noPrice: 1.0 - (m.price_yes_bp.unwrap_or(0) as f64) / 10_000.0,
        endDate: m.end_date_utc.to_rfc3339(),
    }).collect();

    Ok(Json(MarketsPageResponse{ ok: true, items, nextCursor: page.next_cursor }))
}
