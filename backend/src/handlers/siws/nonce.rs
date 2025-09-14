use axum::{extract::State, Json};
use serde::Serialize;
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

use crate::state::SharedState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NonceResp {
    nonce: String,
    domain: String,
    uri: String,
    network: String,
    ttl_sec: u64,
}

// Generate short-lived nonce
pub async fn get_nonce(State(state): State<SharedState>) -> Json<NonceResp> {
    // Create random alphanumeric string
    let nonce: String = Uuid::new_v4()
        .to_string()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(24)
        .collect();

    let expires = OffsetDateTime::now_utc() + Duration::minutes(5);

    // Store nonce with expiry in state
    state.nonces.lock().await.insert(nonce.clone(), expires);

    Json(NonceResp {
        nonce,
        domain: state.domain.clone(),
        uri: state.uri.clone(),
        network: "devnet".into(),
        ttl_sec: 300,
    })
}
