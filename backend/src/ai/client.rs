use crate::ai::parse::extract_last_probability;
use reqwest::{Client, header};
use serde_json::{Value, json};
use axum::http::StatusCode;
use uuid::Uuid;

// use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
// use std::sync::Arc;

// fn make_client_with_cookies() -> (Client, Arc<CookieStoreMutex>) {
//     let jar = Arc::new(CookieStoreMutex::new(CookieStore::default()));
//     let client = Client::builder()
//         .cookie_provider(jar.clone())
//         .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
//         .build()
//         .expect("reqwest client");
//     (client, jar)
// }

fn http_err<E: std::fmt::Display>(code: StatusCode, e: E) -> (StatusCode, String) {
    (code, e.to_string())
}

pub async fn fetch_probability() -> Result<f64, (StatusCode, String)> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| http_err(StatusCode::INTERNAL_SERVER_ERROR, format!("client build: {e}")))?;

    let visitor_id = Uuid::new_v4().to_string();

    let query = "Will Ethereum reach $5,000 by end of 2025?";
    let question = format!(
        "You are a financial reasoning assistant. Task: {q} \
         Step 1: Collect and summarize recent expert predictions, on-chain data, and macroeconomic indicators. \
         Step 2: Compare optimistic and pessimistic scenarios. \
         Step 3: Provide a balanced conclusion. \
         Output strictly in this format (one line only): RESULT:{{probability: <number>%}} \
         Rules: - Do not output analysis text, only the final RESULT line. - If uncertain, still return your best estimate.",
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

    let mut headers = header::HeaderMap::new();
    headers.insert(
        header::COOKIE,
        header::HeaderValue::from_str(&format!("pplx.visitor-id={visitor_id}; Path=/; Domain=.perplexity.ai"))
            .map_err(|e| http_err(StatusCode::INTERNAL_SERVER_ERROR, format!("cookie hdr: {e}")))?,
    );
    headers.insert(header::ACCEPT, header::HeaderValue::from_static("text/event-stream"));
    headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/json"));

    let resp = client
        .post("https://www.perplexity.ai/rest/sse/perplexity_ask")
        .headers(headers)
        .json(&payload)
        .send()
        .await
        .map_err(|e| http_err(StatusCode::BAD_GATEWAY, format!("post failed: {e}")))?;

    let status = resp.status();

    let body = resp
        .text()
        .await
        .map_err(|e| http_err(StatusCode::BAD_GATEWAY, format!("read body failed: {e}")))?;

    tracing::info!("perplexity_ask response: {}", status);

    if let Some((_raw, _json_obj, prob)) = extract_last_probability(&body) {
        Ok(prob)
    } else {
        Err((StatusCode::BAD_GATEWAY, "Could not find probability in the answer".into()))
    }
}