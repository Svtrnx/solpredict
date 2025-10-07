use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use axum_extra::extract::CookieJar;

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
    price_yes: Option<f64>,

    entry_price: Option<f64>,

    result: Option<String>,
    payout: Option<f64>,
    resolved_date: Option<String>,

    end_date: Option<String>,
    market_outcome: Option<String>,
    needs_claim: Option<bool>,
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

fn calc_net_claim_1e6(
    winning_side: Option<i16>,
    payout_pool_1e6: Option<i64>,
    total_winning_side_1e6: Option<i64>,
    user_winning_amount_1e6: i64,
    user_yes_bet_1e6: i64,
    user_no_bet_1e6: i64,
) -> Option<i64> {
    match winning_side {
        Some(3) => {
            Some(user_yes_bet_1e6.saturating_add(user_no_bet_1e6))
        }
        Some(1) | Some(2) => {
            let pool = payout_pool_1e6?;
            let total = total_winning_side_1e6?;
            if total <= 0 { return Some(0); }
            // floor(pool * user / total)
            Some(((pool as i128) * (user_winning_amount_1e6 as i128) / (total as i128)) as i64)
        }
        _ => None, // not settled
    }
}

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

    let wallet = resolve_wallet(&jar, &q.wallet, &state)?;

    let kind: bets_repo::BetKind = q.kind_raw.into();
    let limit = q.limit.unwrap_or(15).clamp(1, 100) as i64;

    let page =
        bets_repo::fetch_user_bets_page(state.db.pool(), &wallet, kind, limit, q.cursor.as_deref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    let items = page
        .items
        .into_iter()
        .map(|b| {
            let amount = (b.amount_1e6 as f64) / 1_000_000.0;

            let p_yes_now = to_prob(b.price_yes_bp);

            let entry = entry_on_side(&b.side, b.price_yes_bp_at_bet);
            let current = current_on_side(&b.side, b.price_yes_bp);

            let deadline_str = b.end_date_utc.format(DATETIME_API).to_string();

            let net_1e6 = calc_net_claim_1e6(
                b.winning_side,
                b.payout_pool_1e6,
                b.total_winning_side_1e6,
                b.user_winning_amount_1e6,
                b.user_yes_bet_1e6,
                b.user_no_bet_1e6,
            );
            let payout = net_1e6.map(|v| (v as f64) / 1_000_000.0);

            let (result, resolved_date, end_date) = if let Some(ws) = b.winning_side {
                // settled
                let res = match ws {
                    1 if b.side == "yes" => "won",
                    2 if b.side == "no"  => "won",
                    3 => "void",
                    _ => "lost",
                }.to_string();
                (Some(res), Some(deadline_str.clone()), None)
            } else {
                // not settled
                (None, None, Some(deadline_str.clone()))
            };

            BetDto {
                id: b.id.to_string(),
                title: generate_title(&TitleSpec::from(&b)),
                market_pda: b.market_pda.clone(),
                side: b.side,
                amount,

                current_price: Some(current),
                price_yes: Some(p_yes_now),

                entry_price: Some(entry),

                result,
                payout,
                resolved_date,

                end_date,
                market_outcome: b.market_outcome.clone(),
                needs_claim: Some(b.needs_claim),
            }
        })
        .collect();

    Ok(Json(BetsPageResponse {
        ok: true,
        items,
        next_cursor: page.next_cursor,
    }))
}