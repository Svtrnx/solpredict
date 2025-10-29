use anchor_lang::prelude::*;

#[event]
pub struct Airdropped {
    pub user: Pubkey,
    pub ata: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MarketProposedAi {
    pub market: Pubkey,
    pub outcome_idx: u8,
    pub winners_mask: u8,
    pub pot: u128,
}

#[event]
pub struct MarketResolvedAi {
    pub market: Pubkey,
    pub outcome_idx: u8,
    pub winners_mask: u8,
    pub pot: u128,
    pub fee: u128,
    pub tip: u128,
    pub payout_pool: u128,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winning_side: u8, // 1=YES, 2=NO, 3=VOID
    pub resolved_price_1e6: i64,
    pub pot: u128,
    pub fee: u128,
    pub tip: u128,
    pub payout_pool: u128,
}