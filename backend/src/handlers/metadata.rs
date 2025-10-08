use serde::Deserialize;
use serde_json::json;

use axum::{
    http::{HeaderMap, StatusCode},
    extract::State,
    Json,
};

use crate::{solana::anchor_client as acli, state::SharedState};

#[derive(Deserialize)]
pub struct MetadataReq {
    pub uri: String,
}

// ====== POST /v1/admin/metadata ======

// Endpoint: set token metadata (admin-only)
pub async fn set_token_metadata(
    State(_app): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<MetadataReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Simple admin check using x-admin-token header
    let want = std::env::var("ADMIN_TOKEN").unwrap_or_default();
    let got = headers
        .get("x-admin-token")
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();
    if want.is_empty() || got != want {
        return Err((StatusCode::UNAUTHORIZED, "unauthorized".into()));
    }

    // Feature flag to disable init in production if needed
    if std::env::var("INIT_ENABLED").unwrap_or_else(|_| "true".into()) != "true" {
        return Err((StatusCode::FORBIDDEN, "init disabled".into()));
    }

    // Run anchor-client to update metadata
    let uri = req.uri.clone();
    let res = tokio::task::spawn_blocking(move || -> anyhow::Result<String> {
        let ctx = acli::connect_devnet()?;
        let sig = acli::set_token_metadata(&ctx, &uri)?;
        Ok(sig.to_string())
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("join error: {e}"),
        )
    })?
    .map_err(|e| {
        let es = e.to_string();
        // if metadata already exists — return 409
        if es.contains("already") || es.contains("initialized") {
            (StatusCode::CONFLICT, "metadata already exists".into())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, es)
        }
    })?;

    Ok(Json(json!({ "ok": true, "tx": res })))
}
