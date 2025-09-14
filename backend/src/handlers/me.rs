// handlers/me.rs
use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};

use crate::state::SharedState;

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
    walletAddress: String,
    walletId: String,
    chain: &'static str,
    exp: usize,
}

#[derive(Serialize)]
struct MeResponse {
    ok: bool,
    user: MeUser,
}

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

    // Response with user info
    let claims = data.claims;
    Json(MeResponse {
        ok: true,
        user: MeUser {
            id: claims.sub,
            walletAddress: claims.wallet,
            walletId: claims.wallet_id,
            chain: "solana",
            exp: claims.exp,
        },
    })
    .into_response()
}
