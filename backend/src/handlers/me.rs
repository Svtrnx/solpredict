use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use jsonwebtoken::{DecodingKey, Validation, decode};
use axum_extra::extract::cookie::CookieJar;
use serde::{Deserialize, Serialize};

use crate::{state::SharedState};

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,       // user_id (UUID)
    wallet: String,    // base58 wallet address
    wallet_id: String, // wallet record UUID
    exp: usize,
}

#[derive(Serialize)]
struct MeUser {
    id: String,
    wallet_address: String,
    wallet_id: String,
    chain: &'static str,
    exp: usize,
}

#[derive(Serialize)]
struct MeResponse {
    ok: bool,
    user: MeUser,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeOverviewResponse {
    ok: bool,
    address: String,
    total_volume: f64,
    total_bets: i64,
    active_bets: i64,
    win_rate: f64,
    win_rate_change: f64,
    rank: i64,
    rank_change: i64,
    level: String,
    points: i64,
    streak: i64,
    join_date: String,
}

// ====== GET /v1/auth/me ======

// Endpoint: return current authenticated user from session cookie
pub async fn me(State(state): State<SharedState>, jar: CookieJar) -> impl IntoResponse {
    // Read sp_session cookie
    let Some(c) = jar.get("sp_session") else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    let token = c.value();

    // Decode + validate JWT
    let validation = Validation::default();
    let data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(d) => d,
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };

    let claims = data.claims;
    Json(MeResponse {
        ok: true,
        user: MeUser {
            id: claims.sub,
            wallet_address: claims.wallet,
            wallet_id: claims.wallet_id,
            chain: "solana",
            exp: claims.exp,
        },
    })
    .into_response()
}
