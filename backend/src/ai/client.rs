use axum::http::StatusCode;
use impit::cookie::Jar;
use impit::emulation::Browser;
use impit::impit::Impit;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::ai::parse::extract_last_probability;

pub async fn fetch_probability() -> Result<f64, (StatusCode, String)> {
    let client = Impit::<Jar>::builder()
        .with_browser(Browser::Chrome)
        .build();

    let resp = client
        .get("https://www.perplexity.ai/".to_string(), None, None)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("first get failed: {e}")))?;

    let visitor_id = resp
        .cookies()
        .find(|c| c.name() == "pplx.visitor-id")
        .map(|c| c.value().to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let query = "Will Ethereum reach $5,000 by end of 2025?";
    let question = concat!("You are a financial reasoning assistant. Task: ", "");
    let question = format!(
        "{question}{q} Step 1: Collect and summarize recent expert predictions, on-chain data, and macroeconomic indicators. Step 2: Compare optimistic and pessimistic scenarios. Step 3: Provide a balanced conclusion. Output strictly in this format (one line only): RESULT:{{probability: <number>%}} Rules: - Do not output analysis text, only the final RESULT line. - If uncertain, still return your best estimate.",
        q = query
    );

    let payload: Value = json!({
        "query_str": question,
        "params": {
            "prompt_source": "user",
            "attachments": [],
            "sources": ["web"],
            "timezone": "Europe/Bucharest",
            "visitor_id": visitor_id,
            "dsl_query": question,
            "is_sponsored": false,
            "language": "ru-RU",
            "time_from_first_type": 8493,
            "local_search_enabled": false,
            "mode": "concise",
            "skip_search_enabled": true,
            "override_no_search": false,
            "comet_max_assistant_enabled": false,
            "is_related_query": false,
            "search_focus": "internet",
            "use_schematized_api": true,
            "supported_block_use_cases": [
                "answer_modes","media_items","knowledge_cards","inline_entity_cards","place_widgets",
                "finance_widgets","sports_widgets","shopping_widgets","jobs_widgets","search_result_widgets",
                "clarification_responses","inline_images","inline_assets","inline_finance_widgets","placeholder_cards",
                "diff_blocks","inline_knowledge_cards","entity_group_v2","refinement_filters"
            ],
            "query_source": "home",
            "client_coordinates": serde_json::Value::Null,
            "always_search_override": false,
            "is_nav_suggestions_disabled": false,
            "is_incognito": false,
            "frontend_uuid": Uuid::new_v4().to_string(),
            "frontend_context_uuid": Uuid::new_v4().to_string(),
            "version": "2.18",
            "model_preference": "turbo",
            "send_back_text_in_streaming_api": false,
            "mentions": [],
            "search_recency_filter": serde_json::Value::Null
        }
    });

    let body_bytes = serde_json::to_vec(&payload).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("serialize json failed: {e}"),
        )
    })?;

    let resp = client
        .post(
            "https://www.perplexity.ai/rest/sse/perplexity_ask".to_string(),
            Some(body_bytes.into()),
            None,
        )
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("second get failed: {e}")))?;

    tracing::info!("perplexity_ask response: {}", resp.status());

    let body = resp
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("read body failed: {e}")))?;

    if let Some((_raw, _json_obj, prob)) = extract_last_probability(&body) {
        Ok(prob)
    } else {
        Err((
            StatusCode::BAD_GATEWAY,
            "Could not find probability in the answer".into(),
        ))
    }
}
