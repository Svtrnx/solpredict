use axum::{
    Json,
    extract::State,
    http::{StatusCode, header},
    response::IntoResponse,
};
use cookie::{Cookie, SameSite};
use jsonwebtoken::{EncodingKey, Header, encode};
use serde::Serialize;
use siws::{
    message::{SiwsMessage, ValidateOptions},
    output::SiwsOutput,
};
use time::{Duration, OffsetDateTime};

use crate::repo::users;
use crate::state::SharedState;

#[derive(Serialize)]
struct VerifyOk {
    ok: bool,
}

#[derive(Serialize)]
struct Claims {
    sub: String,       // app user id
    wallet: String,    // base58 wallet address
    wallet_id: String, // db wallet id
    iat: usize,        // issued-at
    exp: usize,        // expires-at
}

pub async fn verify(
    State(state): State<SharedState>,
    Json(output): Json<SiwsOutput>,
) -> impl IntoResponse {
    // Parse SIWS message from signed bytes
    let msg = match SiwsMessage::try_from(&output.signed_message) {
        Ok(m) => m,
        Err(_) => return (StatusCode::BAD_REQUEST, "bad SIWS message").into_response(),
    };

    let now = OffsetDateTime::now_utc();

    // Validate only the domain
    if let Err(e) = msg.validate(ValidateOptions {
        domain: Some(state.domain.clone()),
        time: None,
        nonce: None,
    }) {
        tracing::warn!(?e, msg_domain=%msg.domain, expected_domain=%state.domain, "SIWS domain check failed");
        return (StatusCode::UNAUTHORIZED, "SIWS validation failed").into_response();
    }

    // Our own time checks with small allowed skew
    const SKEW_SECS: i64 = 60;
    if let Some(iat) = msg.issued_at.as_ref() {
        if *iat.as_ref() > now + Duration::seconds(SKEW_SECS) {
            return (StatusCode::UNAUTHORIZED, "issued_at is in the future").into_response();
        }
    }
    if let Some(exp) = msg.expiration_time.as_ref() {
        if *exp.as_ref() < now {
            return (StatusCode::UNAUTHORIZED, "siws message expired").into_response();
        }
    }
    if let Some(nbf) = msg.not_before.as_ref() {
        if *nbf.as_ref() > now + Duration::seconds(SKEW_SECS) {
            return (StatusCode::UNAUTHORIZED, "siws message not valid yet").into_response();
        }
    }

    // Anti-replay: nonce must exist and be unexpired - one-time use
    let Some(nonce) = msg.nonce.as_deref() else {
        return (StatusCode::BAD_REQUEST, "missing nonce").into_response();
    };
    {
        let mut map = state.nonces.lock().await;
        match map.remove(nonce) {
            Some(expires_at) if expires_at >= now => {}
            _ => return (StatusCode::UNAUTHORIZED, "nonce invalid or expired").into_response(),
        }
    }

    // Verify signature
    if output.verify().is_err() {
        return (StatusCode::UNAUTHORIZED, "signature verification failed").into_response();
    }

    let now = OffsetDateTime::now_utc();
    let address = bs58::encode(&output.account.public_key).into_string();

    // Create or fetch wallet in DB
    let (user_id, wallet_id) = match users::upsert_wallet(state.db.pool(), &address, now).await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(error=?e, "db upsert_wallet failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response();
        }
    };

    // Build JWT
    let iat = now.unix_timestamp() as usize;
    let exp = (now + Duration::hours(24 * 3)).unix_timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        wallet: address,
        wallet_id: wallet_id.to_string(),
        iat,
        exp,
    };

    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "jwt encode error").into_response(),
    };

    // Set session cookie (HttpOnly; Secure if https)
    let secure = state.uri.starts_with("https://");
    let cookie = Cookie::build(("sp_session", token))
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(Duration::hours(24))
        .build();

    // Return
    let headers = [(header::SET_COOKIE, cookie.to_string())];
    (StatusCode::OK, headers, Json(VerifyOk { ok: true })).into_response()
}
