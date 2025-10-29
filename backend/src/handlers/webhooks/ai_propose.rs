use axum::{extract::State, http::{HeaderMap, StatusCode}, Json};
use serde::Deserialize;
use serde_json::json;
use anyhow::anyhow;
use tracing::info;

use crate::{
	solana as anchor_client_,
	usecases::perplexity::PerplexityClient,
	repo::market as market_repo,
    state::SharedState,
    error::AppError,
};

#[derive(Deserialize)]
pub struct AiProposeReq {
    pub market_pda: String,
}

fn admin_token() -> Result<String, AppError> {
    std::env::var("ADMIN_TOKEN")
        .map_err(|_| AppError::Other(anyhow!("ADMIN_TOKEN is not set")))
}

fn get_api_key(headers: &HeaderMap) -> Option<&str> {
    use axum::http::header::HeaderName;
    static X_API_KEY: HeaderName = HeaderName::from_static("x-api-key");
    headers.get(&X_API_KEY).and_then(|v| v.to_str().ok())
}

pub async fn ai_propose_webhook(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<AiProposeReq>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let admin = admin_token()?;
    match get_api_key(&headers) {
        Some(v) if v == admin => {},
        Some(_) => return Ok((StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid X-API-KEY"})))),
        None => return Ok((StatusCode::UNAUTHORIZED, Json(json!({"error":"missing X-API-KEY"})))),
    }

    let market_pubkey = anchor_client_::parse_pubkey(&body.market_pda)
        .map_err(|e| AppError::bad_request(format!("invalid market_pda: {e}")))?;

    let ai = market_repo::fetch_ai_resolver_input_by_pda(&state.db.pool(), &body.market_pda)
        .await
        .map_err(AppError::Other)?
        .ok_or(AppError::NotFound)?;

    let end_utc = ai
        .end_date_utc
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S%:z").to_string())
        .unwrap_or_else(|| "1970-01-01 00:00:00+00:00".to_string());

    let pplx_key = std::env::var("PERPLEXITY_API_KEY").unwrap_or_default();
    if pplx_key.is_empty() {
        return Ok((StatusCode::PRECONDITION_REQUIRED, Json(json!({"error":"PERPLEXITY_API_KEY is empty"}))));
    }

    let pplx = PerplexityClient::new(pplx_key);
    let (_raw, mapped_u8) = pplx
        .resolve_yes_no_sonar_pro(
            &ai.ai_topic,
            &ai.ai_description,
            &ai.ai_criteria_md,
            &end_utc,
            &ai.ai_accepted_sources,
        )
        .await
        .map_err(|e| AppError::bad_request(format!("sonar-pro failed: {e}")))?;

    info!(%market_pubkey, mapped = mapped_u8, "sonar-pro mapped idx (0=YES,1=NO)");

    let outcome_u8: u8 = u8::try_from(mapped_u8)
    .map_err(|_| AppError::bad_request("ai_answer_idx must be 0 or 1".to_string()))?;

	let state_cloned = state.clone();
	let sig = tokio::task::spawn_blocking(move || {
			anchor_client_::ai_propose_prepare(&state_cloned, market_pubkey, outcome_u8)
		})
		.await
		.map_err(|e| AppError::Other(anyhow!("join error: {e}")))?
		.map_err(|e| AppError::Other(anyhow!("ai_propose onchain failed: {e}")))?;

    Ok((StatusCode::OK, Json(json!({
        "status": "ok",
        "market_pda": body.market_pda,
        "ai_answer_idx": mapped_u8,
        "tx": sig.to_string()
    }))))
}
