// ====== DEV Endpoint ======
use axum::http::StatusCode;
use crate::ai::client::fetch_probability;

pub async fn get_probability() -> Result<String, (StatusCode, String)> {
    tracing::info!("get_probability");

    let probability = fetch_probability().await?;

    Ok(format!("RESULT:{{probability: {}%}}", probability))
}
