use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};
use time::format_description::well_known::Rfc3339;

use crate::{error::AppError, state::SharedState};
use crate::usecases::ai_jobs::{AiJobValue, ProposalWithId, get_job};
use crate::handlers::market::types::current_user_pubkey;

use crate::solana as anchor_client_;
use anchor_client::solana_sdk::pubkey::Pubkey;

#[derive(Deserialize)]
pub struct AiValidateSelectReq {
    pub hash: String,
    pub id: String,
}

#[derive(Serialize)]
pub struct AiValidateSelectResp {
    pub ok: bool,
    pub market_id: String,
    pub create_tx: String,
    pub chosen: ProposalWithId,
    pub message: String,
}

// ====== POST /v1/markets/ai/validate/select ======
pub async fn post_ai_validate_select(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<AiValidateSelectReq>,
) -> Result<Json<AiValidateSelectResp>, AppError> {
    let user_pubkey = current_user_pubkey(&headers, &state.jwt_secret)?;

    let job = get_job(&state, &req.hash).await.map_err(AppError::Other)?;
    let Some(AiJobValue::Ready { data, .. }) = job else {
        return Err(AppError::bad_request("job not ready or expired"));
    };

    if !data.accept {
        return Err(AppError::bad_request(format!(
            "market was rejected by validator: {}",
            data.reason
        )));
    }

    let Some(p) = data.proposals.into_iter().find(|p| p.id == req.id) else {
        return Err(AppError::bad_request("proposal id not found"));
    };

    let end_dt = OffsetDateTime::parse(&p.end_time_utc, &Rfc3339)
        .map_err(|_| AppError::bad_request("bad end_time_utc format (use RFC3339, e.g. 2025-01-01T00:00:00Z)"))?;
    let now = OffsetDateTime::now_utc();
    if end_dt < (now + Duration::minutes(10)) {
        return Err(AppError::bad_request("End time must be at least 10 minutes in the future"));
    }
    let end_ts: i64 = end_dt.unix_timestamp();

    let ai_oracle_pubkey: Pubkey = state.ai_oracle_pubkey
        .parse()
        .map_err(|_| AppError::Other(anyhow::anyhow!("AI_ORACLE_PUBKEY is invalid base58")))?;

	let memo_json = format!(r#"{{"k":"ai1","h":"{}","p":"{}"}}"#, req.hash, req.id);
    let ctx = state.anchor.clone();
    let (tx_base64, market_pda) = tokio::task::spawn_blocking(move || {
        anchor_client_::build_create_market_ai_binary_unsigned(
            &ctx,
            user_pubkey,
            end_ts,
            ai_oracle_pubkey,
			Some(&memo_json),
        )
    })
    .await
    .map_err(|e| AppError::Other(anyhow::anyhow!("Join error: {e}")))?
    .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    Ok(Json(AiValidateSelectResp {
        ok: true,
        market_id: market_pda.to_string(),
        create_tx: tx_base64,
        chosen: p,
        message: "AI binary market create tx (unsigned) built".into(),
    }))
}
