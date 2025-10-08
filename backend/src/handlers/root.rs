use axum::response::IntoResponse;

// ====== GET / ======

pub async fn index() -> impl IntoResponse {
    "SolPredict: OK"
}
