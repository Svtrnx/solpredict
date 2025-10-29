use anchor_client::solana_sdk::pubkey::Pubkey;
use prediction_market_program as onchain;

// Constants for PDA seeds
const MARKET_SEED: &[u8] = b"market";
const ESCROW_SEED: &[u8] = b"escrow-auth";
const CONFIG_SEED: &[u8] = b"config";
const POSITION_SEED: &[u8] = b"position";
const MINT_AUTH_SEED: &[u8] = b"mint-auth";
const CLAIM_SEED: &[u8] = b"claim";
const OUTCOME_PREFIX: &[u8] = b"o";

pub const SIDE_YES: &[u8] = b"yes";
pub const SIDE_NO: &[u8] = b"no";

/// Derive market PDA for Pyth oracle markets
pub fn pda_market(user: &Pubkey, feed: &[u8; 32], end_ts: i64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[MARKET_SEED, user.as_ref(), feed.as_ref(), &end_ts.to_le_bytes()],
        &onchain::ID,
    )
}

/// Derive market PDA for AI oracle markets
pub fn pda_market_ai(authority: &Pubkey, end_ts: i64, oracle_kind: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[MARKET_SEED, authority.as_ref(), &end_ts.to_le_bytes(), &[oracle_kind]],
        &onchain::ID,
    )
}

/// Derive escrow authority PDA for binary markets (yes/no)
pub fn pda_escrow_auth(market: &Pubkey, side: &[u8]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ESCROW_SEED, market.as_ref(), side],
        &onchain::ID,
    )
}

/// Derive escrow authority PDA for multi-outcome markets
pub fn pda_escrow_auth_outcome(market: &Pubkey, outcome_idx: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ESCROW_SEED, market.as_ref(), OUTCOME_PREFIX, &[outcome_idx]],
        &onchain::ID,
    )
}

/// Derive config PDA
pub fn pda_config() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], &onchain::ID)
}

/// Derive position PDA for binary markets
pub fn pda_position(market: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[POSITION_SEED, market.as_ref(), user.as_ref()],
        &onchain::ID,
    )
}

/// Derive position PDA for multi-outcome markets
pub fn pda_position_multi(market: &Pubkey, user: &Pubkey, outcome_idx: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[POSITION_SEED, market.as_ref(), user.as_ref(), &[outcome_idx]],
        &onchain::ID,
    )
}

/// Derive mint authority PDA
pub fn pda_mint_auth() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MINT_AUTH_SEED], &onchain::ID)
}

/// Derive claim PDA for airdrop
pub fn pda_claim(user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CLAIM_SEED, user.as_ref()], &onchain::ID)
}
