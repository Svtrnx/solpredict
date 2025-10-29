use anchor_lang::prelude::*;

#[account]
pub struct PositionBin {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_bet: u64,
    pub no_bet: u64,
    pub claimed: bool,
}

impl PositionBin {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct PositionMulti {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome_idx: u8,
    pub stake: u64,
    pub claimed: bool,
}

impl PositionMulti {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct AirdropClaim {
    pub claimed: bool,
    pub when: i64,
}

impl AirdropClaim {
    pub const SIZE: usize = 1 + 8;
}