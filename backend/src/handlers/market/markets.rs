use axum::{extract::{Path, Query, State}, Json, http::{StatusCode}};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    handlers::market::types::{generate_title, MarketDto, TitleSpec}, 
    repo::{bets as bets_repo, market as market_repo}, 
    state::SharedState,
    error::AppError, 
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
pub struct MarketDtoV2 {
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
    items: Vec<MarketDtoV2>,
    next_cursor: Option<String>, // base64 "{updated_at}|{id}"
}

#[derive(Deserialize)]
pub struct MarketsQuery {
    limit: Option<u32>,          // default 15
    cursor: Option<String>,      // cursor for keyset
    category: Option<String>,    // filter by category
    sort: Option<String>,        // sort
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

// ====== GET /v1/markets ======

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
        q.sort.as_deref(),
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    let items = page.items.into_iter().map(|m| MarketDtoV2{
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

// ====== GET /v1/markets/{market_address} ======

pub async fn handle(
    State(state): State<SharedState>,
    Path(market_address): Path<String>,
) -> Result<Json<MarketDto>, AppError> {
    let Some(row) = market_repo::find_by_address(&state.db.pool(), &market_address).await
        .map_err(AppError::from)? else {
            return Err(AppError::NotFound);
        };

    Ok(Json(MarketDto::from(row)))
}

// ====== GET /v1/markets/bets ======

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentBetDto {
    user_address: String,
    side: String,
    amount: f64,
    #[serde(with = "time::serde::rfc3339")]
    timestamp: OffsetDateTime,
    cursor_id: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentBetsPageDto {
    items: Vec<RecentBetDto>,
    next_cursor: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct RecentBetsQuery {
    pub limit:      Option<i64>,
    pub cursor:     Option<i64>,
    #[serde(rename = "marketPda")]
    pub market_pda: Option<String>,
    pub address:    Option<String>,
}

pub async fn recent_bets(
    State(state): State<SharedState>,
    Query(q): Query<RecentBetsQuery>,
) -> Result<Json<RecentBetsPageDto>, AppError> {
    let limit = q.limit.unwrap_or(50).clamp(1, 100);

    let page = bets_repo::fetch_recent_bets(
        state.db.pool(),
        limit,
        q.cursor,
        q.market_pda.as_deref(),
        q.address.as_deref(),
    )
    .await
    .map_err(AppError::from)?;

    let items = page.items.into_iter().map(|r| RecentBetDto {
        user_address: r.user_address,
        side: r.side,
        amount: r.amount,
        timestamp: r.timestamp,
        cursor_id: r.cursor_id,
    }).collect();

    Ok(Json(RecentBetsPageDto { items, next_cursor: page.next_cursor }))
}