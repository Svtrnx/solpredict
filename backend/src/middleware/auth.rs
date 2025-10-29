use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use axum_extra::extract::cookie::Cookie;
use serde::Deserialize;
use uuid::Uuid;

use axum::{
    http::{Request, StatusCode, header},
    response::IntoResponse,
    middleware::Next,
    extract::State,
    body::Body,
};

use crate::{state::SharedState, repo::users::exists_user_wallet};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Claims {
    sub: String,       // user_id (UUID)
    wallet: String,    // base58 address
    wallet_id: String, // wallet UUID
    iat: usize,
    exp: usize,
}

#[derive(Clone, Debug)]
pub struct CurrentUser {
    pub user_id: String,
    pub wallet_id: String,
    pub wallet: String,
}

// Middleware: require authenticated user (checks cookie + JWT + DB)
pub async fn require_user(
    State(state): State<SharedState>,
    mut req: Request<Body>,
    next: Next,
) -> impl IntoResponse {
    // Read Cookie header
    let Some(cookie_hdr) = req.headers().get(header::COOKIE) else {
        return (StatusCode::UNAUTHORIZED, "no cookies").into_response();
    };
    let Ok(cookies_str) = cookie_hdr.to_str() else {
        return (StatusCode::BAD_REQUEST, "bad cookie header").into_response();
    };

    // Extract sp_session cookie
    let mut token: Option<String> = None;
    for kv in cookies_str.split(';') {
        if let Ok(c) = Cookie::parse(kv.trim()) {
            if c.name() == "sp_session" {
                token = Some(c.value().to_string());
                break;
            }
        }
    }
    let Some(token) = token else {
        return (StatusCode::UNAUTHORIZED, "missing sp_session").into_response();
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let data = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(d) => d,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid token").into_response(),
    };
    let claims = data.claims;

    // Parse UUIDs from strings
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid user_id format").into_response(),
    };

    let wallet_id = match Uuid::parse_str(&claims.wallet_id) {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid wallet_id format").into_response(),
    };

    match exists_user_wallet(
        state.db.pool(),
        user_id,
        wallet_id,
        &claims.wallet,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return (StatusCode::UNAUTHORIZED, "account disabled or not found").into_response();
        }
        Err(e) => {
            tracing::error!(error=?e, user_id=%claims.sub, wallet_id=%claims.wallet_id, wallet=%claims.wallet, "exists_user_wallet failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response();
        }
    }

    // Inject CurrentUser into request extensions
    let cu = CurrentUser {
        user_id: claims.sub,
        wallet_id: claims.wallet_id,
        wallet: claims.wallet,
    };
    req.extensions_mut().insert(cu);

    // Continue pipeline
    next.run(req).await
}
