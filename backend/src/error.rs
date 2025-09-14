use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde::Serialize;
use thiserror::Error;
use validator::ValidationErrors;

#[derive(Debug, Serialize)]
pub struct ErrorBody { pub error: String, pub code: u16 }

// Application-level error type
#[derive(Debug, Error)]
pub enum AppError {
    #[error("not found")]
    NotFound,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// Convenience constructors
impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        AppError::BadRequest(msg.into())
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        AppError::Unauthorized(msg.into())
    }
}

// Auto-convert validator errors into 400 BadRequest
impl From<ValidationErrors> for AppError {
    fn from(e: ValidationErrors) -> Self {
        AppError::BadRequest(e.to_string())
    }
}

// Convert AppError into proper HTTP response with JSON body
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::NotFound =>
                (StatusCode::NOT_FOUND, Json(ErrorBody { error: "not found".into(), code: 404 })).into_response(),

            AppError::BadRequest(msg) =>
                (StatusCode::BAD_REQUEST, Json(ErrorBody { error: msg, code: 400 })).into_response(),

            AppError::Unauthorized(msg) =>
                (StatusCode::UNAUTHORIZED, Json(ErrorBody { error: msg, code: 401 })).into_response(),

            AppError::Other(e) => {
                tracing::error!(?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorBody {
                    error: "internal error".into(),
                    code: 500
                })).into_response()
            }
        }
    }
}
