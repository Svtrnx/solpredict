use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OracleKind {
    Pyth = 0,
    Ai = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketType {
    PriceThreshold,
    PriceRange,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}