use std::{collections::HashMap, sync::Arc};
use time::OffsetDateTime;
use tokio::sync::Mutex;

use crate::db::Db;
use crate::solana::anchor_client::AnchorCtx;

// Global application state shared across all handlers
pub struct AppState {
    // Nonces for SIWS (Sign-In With Solana) login, with expiry
    pub nonces: Mutex<HashMap<String, OffsetDateTime>>,
    // Secret key for JWT signing/validation
    pub jwt_secret: String,
    // Frontend domain
    pub domain: String,
    // Frontend URI
    pub uri: String,
    // Database connection pool
    pub db: Db,
    // Anchor client context for Solana program
    pub anchor: Arc<AnchorCtx>,
}

// Type alias for shared reference-counted state
pub type SharedState = Arc<AppState>;

impl AppState {
    // Constructor: wrap everything in Arc for thread-safe sharing
    pub fn new(
        domain: impl Into<String>,
        uri: impl Into<String>,
        jwt_secret: impl Into<String>,
        db: Db,
        anchor: Arc<AnchorCtx>,
    ) -> SharedState {
        Arc::new(AppState {
            nonces: Mutex::new(HashMap::new()),
            jwt_secret: jwt_secret.into(),
            domain: domain.into(),
            uri: uri.into(),
            db,
            anchor,
        })
    }
}
