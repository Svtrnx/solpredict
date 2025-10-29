use anchor_lang::prelude::*;
use crate::constants::MAX_OUTCOMES;

#[account]
pub struct Market {
    // Common
    pub authority: Pubkey,
    pub oracle_kind: u8,
    pub ai_oracle_authority: Pubkey,
    pub end_ts: i64,
    pub settled: bool,
    
    // Fee snapshots
    pub fee_bps_snapshot: u16,
    pub resolver_bps_snapshot: u16,
    pub creator_bps_snapshot: u16,
    pub resolver_tip_cap_snapshot: u64,
    pub treasury_wallet_snapshot: Pubkey,

    // Pyth oracle fields
    pub feed_id: [u8; 32],
    pub market_type: u8,
    pub comparator: u8,
    pub bound_lo: i64,
    pub bound_hi: i64,
    pub resolved_price_1e6: i64,

    // Multi-outcome (AI) fields
    pub num_outcomes: u8,
    pub tvl_per_outcome: [u64; MAX_OUTCOMES],
    pub outcome_idx: u8,        // 0..=254 (single), 255 => multi
    pub payout_pool: u64,
    pub winners_mask: u8,
    pub tentative: bool,

    // Legacy binary (Pyth) fields
    pub yes_total: u64,
    pub no_total: u64,
    pub winning_side: u8,       // 0=undef, 1=YES, 2=NO, 3=VOID
}

impl Market {
    pub const SPACE: usize = 8
        + 32 + 1 + 32 + 8 + 1
        + 2 + 2 + 2 + 8 + 32
        + 32 + 1 + 1 + 8 + 8 + 8
        + 1 + (8 * MAX_OUTCOMES) + 1 + 8 + 1 + 1
        + 8 + 8 + 1
        + 32; // padding
}