use axum::response::IntoResponse;

pub async fn index() -> impl IntoResponse {
    "SolPredict: OK"
}
