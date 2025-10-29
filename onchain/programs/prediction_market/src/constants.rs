use anchor_lang::prelude::*;

pub const USDC_MINT: Pubkey = pubkey!("5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh");

// Basis points
pub const BPS_DENOM: u64 = 10_000;

// Seeds
pub const ESCROW_SEED: &[u8] = b"escrow-auth";
pub const SIDE_YES: &[u8] = b"yes";
pub const SIDE_NO: &[u8] = b"no";
pub const OUTCOME_PREFIX: &[u8] = b"o";

// Market outcomes
pub const MAX_OUTCOMES: usize = 5;
pub const OUTCOME_YES: u8 = 0;
pub const OUTCOME_NO: u8 = 1;
pub const OUTCOME_NONE: u8 = u8::MAX; // 255 = no single winner

// Attestation
pub const DOMAIN: &[u8] = b"SOLPREDICT_ATTESTATION_v1";

// Airdrop
pub const AIRDROP_AMOUNT: u64 = 3_000 * 1_000_000; // 3000 USDC

// Resolution timeouts
pub const RESOLVE_HORIZON_SECS: i64 = 15 * 86_400; // 15 days
pub const MAX_PRICE_STALENESS: i64 = 86_400; // 1 day
pub const PRICE_FETCH_GRACE_PERIOD: i64 = 300; // 5 minutes
pub const ATTESTATION_TIME_TOLERANCE: i64 = 3600; // 1 hour
pub const ATTESTATION_FUTURE_TOLERANCE: i64 = 60; // 1 minute