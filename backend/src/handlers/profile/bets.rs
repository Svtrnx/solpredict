use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use axum_extra::extract::CookieJar;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};

use crate::{
    repo::{position as pos_repo},
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
fn detect_side(yes_1e6: i64, no_1e6: i64) -> &'static str {
    if yes_1e6 > 0 && no_1e6 == 0 { "yes" }
    else if no_1e6 > 0 && yes_1e6 == 0 { "no" }
    else { "mixed" }
}

impl From<&pos_repo::PositionRow> for TitleSpec {
    fn from(p: &pos_repo::PositionRow) -> Self {
        TitleSpec {
            symbol: p.symbol.clone(),
            end_date_utc: p.end_date_utc,
            market_type: Some(p.market_type.clone()),
            comparator: p.comparator.clone(),
            bound_lo_1e6: p.bound_lo_1e6,
            bound_hi_1e6: p.bound_hi_1e6,
        }
    }
}


#[derive(Debug, Deserialize)]
#[allow(dead_code)]
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

// ====== GET /v1/profile/bets ======

pub async fn list_bets_public(
    State(state): State<SharedState>,
    jar: CookieJar,
    Query(q): Query<BetsQuery>,
) -> Result<Json<BetsPageResponse>, (StatusCode, String)> {

    let wallet = resolve_wallet(&jar, &q.wallet, &state)?;

    let kind = match q.kind_raw {
        KindParam::Active => pos_repo::BetKind::Active,
        KindParam::History => pos_repo::BetKind::History,
    };
    let limit = q.limit.unwrap_or(15).clamp(1, 100) as i64;

    let page =
        pos_repo::fetch_user_positions_page(state.db.pool(), &wallet, kind, limit, q.cursor.as_deref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db error: {e}")))?;

    let items = page
        .items
        .into_iter()
        .map(|p| {
            let total_1e6 = p.user_yes_bet_1e6.saturating_add(p.user_no_bet_1e6);
            let amount = (total_1e6 as f64) / 1_000_000.0;

            let side_str = detect_side(p.user_yes_bet_1e6, p.user_no_bet_1e6);

            let p_yes_now = to_prob(p.price_yes_bp);
            let current = match side_str {
                "yes" => Some(p_yes_now),
                "no"  => Some(1.0 - p_yes_now),
                _     => None, // mixed
            };

            let deadline_str = p.end_date_utc.format(DATETIME_API).to_string();

            let payout = p.net_claim_1e6.map(|v| (v as f64) / 1_000_000.0);

            let (result, resolved_date, end_date) = match p.winning_side {
                Some(1) => { // YES
                    let won = p.user_yes_bet_1e6 > 0;
                    (Some(if won { "won".into() } else { "lost".into() }),
                    Some(deadline_str.clone()),
                    None)
                }
                Some(2) => { // NO
                    let won = p.user_no_bet_1e6 > 0;
                    (Some(if won { "won".into() } else { "lost".into() }),
                    Some(deadline_str.clone()),
                    None)
                }
                Some(3) => (Some("void".into()), Some(deadline_str.clone()), None),
                _ => (None, None, Some(deadline_str.clone())), // not settled
            };

            BetDto {
                id: p.market_id.to_string(),
                title: generate_title(&TitleSpec::from(&p)),
                market_pda: p.market_pda.clone(),
                side: side_str.to_string(),
                amount,

                current_price: current,
                price_yes: Some(p_yes_now),

                entry_price: None,

                result,
                payout,
                resolved_date,

                end_date,
                market_outcome: p.market_outcome.clone(),
                needs_claim: Some(p.needs_claim),
            }
        })
        .collect::<Vec<_>>();


    Ok(Json(BetsPageResponse {
        ok: true,
        items,
        next_cursor: page.next_cursor,
    }))
}