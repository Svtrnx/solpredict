use anchor_lang::prelude::*;

#[error_code]
pub enum AirdropError {
    #[msg("Airdrop already claimed for this wallet")]
    AlreadyClaimed,
    #[msg("Wrong mint")]
    WrongMint,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be > 0")]
    InvalidAmount,
    #[msg("Overflow in arithmetic operation")]
    Overflow,
    #[msg("Unauthorized: only authority can perform this action")]
    Unauthorized,
    #[msg("Wrong mint provided")]
    WrongMint,
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Too early to resolve market")]
    TooEarly,
    #[msg("Too late to place bet")]
    TooLateToBet,
    #[msg("Invalid or stale price feed")]
    InvalidPriceFeed,
    #[msg("Invalid comparator value")]
    BadComparator,
    #[msg("Invalid market type or configuration")]
    BadMarketType,
    #[msg("Market not resolved yet")]
    MarketNotResolved,
    #[msg("No winning bet to claim")]
    NoWinningBet,
    #[msg("Payout already claimed")]
    AlreadyClaimed,
    #[msg("Invalid basis points value (must be <= 10000)")]
    BadBps,
    #[msg("Pyth price data is stale")]
    StalePrice,
}