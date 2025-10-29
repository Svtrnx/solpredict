use anchor_lang::prelude::*;
use crate::constants::{ESCROW_SEED, OUTCOME_PREFIX};

/// PDA for market escrow authority (Yes/No for binary markets)
pub fn pda_escrow_auth(market: &Pubkey, side: &[u8], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ESCROW_SEED, market.as_ref(), side], program_id)
}

/// PDA for market escrow authority by outcome index (multi-outcome markets)
pub fn pda_escrow_auth_outcome(market: &Pubkey, outcome_idx: u8, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ESCROW_SEED, market.as_ref(), OUTCOME_PREFIX, &[outcome_idx]],
        program_id,
    )
}

/// Signer seeds for escrow authority (Yes/No)
pub fn escrow_signer_seeds<'a>(
    market: &'a Pubkey,
    side: &'a [u8],
    bump: &'a [u8],
) -> [&'a [u8]; 4] {
    [ESCROW_SEED, market.as_ref(), side, bump]
}

/// Signer seeds for outcome escrow authority
pub fn outcome_signer_seeds<'a>(
    market: &'a Pubkey,
    outcome_idx_arr: &'a [u8],
    bump_arr: &'a [u8],
) -> [&'a [u8]; 5] {
    [ESCROW_SEED, market.as_ref(), OUTCOME_PREFIX, outcome_idx_arr, bump_arr]
}