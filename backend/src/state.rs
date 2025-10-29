use anchor_client::solana_client::nonblocking::rpc_client::RpcClient;
use std::{collections::HashMap, sync::Arc};
use once_cell::sync::OnceCell;
use time::OffsetDateTime;
use tokio::sync::Mutex;

use crate::solana::AnchorCtx;
use crate::db::Db;
use redis::Client as RedisClient;

pub struct AppState {
    // ===== SIWS / auth =====
    pub nonces: Mutex<HashMap<String, OffsetDateTime>>,
    pub jwt_secret: String,
    pub domain: String,
    pub uri: String,

    // ===== Infrastructure =====
    pub db: Db,
    pub redis: RedisClient,
    pub rpc: RpcClient,
    pub rpc_url: String,

    // ===== Solana/Program config =====
    pub program_id: String,
    pub ai_oracle_pubkey: String,
    pub memo_program: String, 
    pub usdc_mint: String, 

    // ===== Anchor ctx =====
    pub anchor: Arc<AnchorCtx>,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub fn new(
        domain: impl Into<String>,
        uri: impl Into<String>,
        jwt_secret: impl Into<String>,
        db: Db,
        redis: RedisClient,
        anchor: Arc<AnchorCtx>,
    ) -> SharedState {
        let _ = dotenvy::dotenv();

        let rpc_url = std::env::var("SOLANA_RPC")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
        let rpc = RpcClient::new(rpc_url.clone());

        let program_id = std::env::var("PREDICTION_PROGRAM_ID")
            .unwrap_or_else(|_| "HhbBippsA7ETvNMNwBbY7Fg8B24DzgJ3nENetYPwR9bQ".to_string());

        let ai_oracle_pubkey = std::env::var("AI_ORACLE_PUBKEY")
            .unwrap_or_else(|_| "3c5XAeXx8dCxn3KAVJuu4mXadcZJNFez3xeXKeq8tyTZ".to_string());

        let memo_program = std::env::var("MEMO_PROGRAM")
            .ok()
            .unwrap_or_else(|| spl_memo::id().to_string());

        let usdc_mint = std::env::var("USDC_MINT")
            .unwrap_or_else(|_| "5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh".to_string());

        Arc::new(AppState {
            nonces: Mutex::new(HashMap::new()),
            jwt_secret: jwt_secret.into(),
            domain: domain.into(),
            uri: uri.into(),
            db,
            redis,
            rpc,
            rpc_url,
            program_id,
            ai_oracle_pubkey,
            memo_program,
            usdc_mint,
            anchor,
        })
    }
}

static APP_STATE: OnceCell<SharedState> = OnceCell::new();

pub fn init_global(state: SharedState) { 
    let _ = APP_STATE.set(state); 
}

pub fn global() -> &'static SharedState { 
    APP_STATE.get().expect("APP_STATE not initialized") 
}
