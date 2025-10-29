use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury_wallet: Pubkey,
    pub fee_bps: u16,
    pub resolver_bps: u16,
    pub creator_bps: u16,
    pub resolver_tip_cap: u64,
}

impl Config {
    pub const SPACE: usize = 8 + 32 + 32 + 2 + 2 + 2 + 8;
}