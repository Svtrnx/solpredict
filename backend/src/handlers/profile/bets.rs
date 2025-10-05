use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use axum_extra::extract::CookieJar;
use serde_json::Number;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};

use crate::{
    repo::bets as bets_repo,
    state::SharedState,
    handlers::market::types::{generate_title, TitleSpec}
};

// ---- helpers ----

#[inline]
fn to_prob(bp: Option<i32>) -> f64 {
    match bp {
        Some(v) => ((v as f64) / 10_000.0).clamp(0.0, 1.0),
        None => 0.5,
    }
}

fn safe_div(num: f64, denom: f64) -> f64 {
    if denom.abs() < 1e-9 { 0.0 } else { num / denom }
}

#[inline]
fn entry_on_side(side: &str, price_yes_bp_at_bet: Option<i32>) -> f64 {
    let p_yes = to_prob(price_yes_bp_at_bet);
    if side == "yes" { p_yes } else { 1.0 - p_yes }
}

#[inline]
fn current_on_side(side: &str, price_yes_bp_now: Option<i32>) -> f64 {
    let p_yes = to_prob(price_yes_bp_now);
    if side == "yes" { p_yes } else { 1.0 - p_yes }
}

#[inline]
fn pnl_percent_active(entry: f64, current: f64) -> f64 {
    (safe_div(current, entry) - 1.0) * 100.0
}

#[inline]
fn pnl_amount_active(amount: f64, entry: f64, current: f64) -> f64 {
    amount * (current - entry)
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    wallet: String,
    wallet_id: String,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Deserialize)]
pub struct BetsQuery {
    #[serde(rename = "kind")]
    kind_raw: KindParam,
    limit: Option<u32>,
    cursor: Option<String>,
    wallet: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KindParam {
    Active,
    History,
}

impl From<&bets_repo::BetRow> for TitleSpec {
    fn from(b: &bets_repo::BetRow) -> Self {
        TitleSpec {
            symbol: b.symbol.clone(),
            end_date_utc: b.end_date_utc,
            market_type: Some(b.market_type.clone()),
            comparator: b.comparator.clone(),
            bound_lo_1e6: b.bound_lo_1e6,
            bound_hi_1e6: b.bound_hi_1e6,
        }
    }
}

impl From<KindParam> for bets_repo::BetKind {
    fn from(k: KindParam) -> Self {
        match k {
            KindParam::Active => bets_repo::BetKind::Active,
            KindParam::History => bets_repo::BetKind::History,
        }
    }
}

/// API DTOs
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetDto {
    id: String,
    title: String,
    market_pda: String,
    side: String,
    amount: f64,
    current_price: Option<f64>,
    entry_price: Option<f64>,
    pnl: f64,
    pnl_amount: Option<Number>,
    end_date: Option<String>,
    status: Option<String>,
    trend: Option<String>,
    result: Option<String>,
    payout: Option<f64>,
    resolved_date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BetsPageResponse {
    ok: bool,
    items: Vec<BetDto>,
    next_cursor: Option<String>,
}

const DATETIME_API: &str = "%Y-%m-%d %H:%M:%S%:z";
// const DATETIME_QUESTION: &str = "%b %d, %Y UTC";

fn resolve_wallet(
    jar: &CookieJar,
    q_wallet: &Option<String>,
    state: &SharedState,
) -> Result<String, (StatusCode, String)> {
    if let Some(w) = q_wallet.as_deref() {
        return Ok(w.to_owned());
    }
    if let Some(token) = jar.get("sp_session").map(|c| c.value().to_string()) {
        let mut v = Validation::new(Algorithm::HS256);
        v.validate_exp = true;
        let data = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
            &v,
        )
        .map_err(|_| (StatusCode::UNAUTHORIZED, "invalid token".to_string()))?;
        return Ok(data.claims.wallet);
    }
    Err((StatusCode::BAD_REQUEST, "wallet is required".into()))
}

pub async fn list_bets_public(
    State(state): State<SharedState>,
    jar: CookieJar,
    Query(q): Query<BetsQuery>,
) -> Result<Json<BetsPageResponse>, (StatusCode, String)> {
    // Whose bets we return
    let wallet = resolve_wallet(&jar, &q.wallet, &state)?;

    // Map kind & normalize limit
    let kind: bets_repo::BetKind = q.kind_raw.into();
    let limit = q.limit.unwrap_or(15).clamp(1, 100) as i64;

    // Fetch page
    let page =
        bets_repo::fetch_user_bets_page(state.db.pool(), &wallet, kind, limit, q.cursor.as_deref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    // Map DB rows -> API DTOs
    let items = page
        .items
        .into_iter()
        .map(|b| {
            let amount = (b.amount_1e6 as f64) / 1_000_000.0;
            let entry = entry_on_side(&b.side, b.price_yes_bp_at_bet);
            let current = current_on_side(&b.side, b.price_yes_bp);
            let deadline_str = b.end_date_utc.format(DATETIME_API).to_string();

            let market_pda = b.market_pda.clone();

            let (pnl, pnl_amount_f64, status, trend, result, resolved_date, end_date) =
                if !b.settled {
                    let pnl = pnl_percent_active(entry, current);
                    let pnl_amount = pnl_amount_active(amount, entry, current);
                    let status = if current >= entry {
                        "winning"
                    } else {
                        "losing"
                    }
                    .to_string();
                    let trend = if current >= entry { "up" } else { "down" }.to_string();
                    (
                        pnl,
                        pnl_amount,
                        Some(status),
                        Some(trend),
                        None,
                        None,
                        Some(deadline_str.clone()),
                    )
                } else {
                    let res = match b.winning_side {
                        Some(1) if b.side == "yes" => "won",
                        Some(2) if b.side == "no" => "won",
                        Some(1) | Some(2) => "lost",
                        _ => "lost",
                    }
                    .to_string();

                    let pnl = if res == "won" { 100.0 } else { -100.0 };
                    let pnl_amount = if res == "won" {
                        amount * (1.0 - entry)
                    } else {
                        -amount
                    };
                    (
                        pnl,
                        pnl_amount,
                        None,
                        None,
                        Some(res),
                        Some(deadline_str.clone()),
                        None,
                    )
                };

            let pnl_amount_f64 = (pnl_amount_f64 * 10.0).round() / 10.0;

            BetDto {
                id: b.id.to_string(),
                title: generate_title(&TitleSpec::from(&b)),
                market_pda,
                side: b.side,
                amount,
                current_price: Some(current),
                entry_price: Some(entry),
                pnl,
                pnl_amount: Number::from_f64(pnl_amount_f64),
                end_date,
                status,
                trend,
                result,
                payout: None,
                resolved_date,
            }
        })
        .collect();

    Ok(Json(BetsPageResponse {
        ok: true,
        items,
        next_cursor: page.next_cursor,
    }))
}
