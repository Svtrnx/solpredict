use axum::{Json, http::{HeaderMap, StatusCode}};
use serde_json::Value;

use crate::usecases::webhooks::handle_helius_raw_item;

// ====== POST /v1/webhooks/helius ======

pub async fn helius(
    _headers: HeaderMap,
    Json(body): Json<Value>
) -> Result<Json<Value>, StatusCode> {
    match &body {
        Value::Array(arr) => {
            for item in arr {
                if let Err(e) = handle_helius_raw_item(item).await {
                    tracing::error!("webhook item handling failed: {e:#?}");
                }
            }
        }
        _ => {
            if let Err(e) = handle_helius_raw_item(&body).await {
                tracing::error!("webhook single-item handling failed: {e:#?}");
            }
        }
    }
    
    Ok(Json(serde_json::json!({ "ok": true })))
}

