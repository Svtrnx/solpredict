use super::{
    context::{AnchorCtx, program},
    pda::{pda_escrow_auth, pda_escrow_auth_outcome, pda_position, pda_position_multi},
    encoding::encode_unsigned_tx,
};
use anchor_client::solana_sdk::{
    pubkey::Pubkey,
    instruction::Instruction,
    transaction::Transaction,
    system_program, sysvar, hash::Hash,
};
use anchor_spl::{
    token::ID as TOKEN_PROGRAM_ID,
    associated_token::{ID as ASSOCIATED_TOKEN_PROGRAM_ID, get_associated_token_address},
};
use anyhow::Result;
use std::sync::Arc;
use prediction_market_program as onchain;

/// Get latest blockhash
fn latest_blockhash(program: &anchor_client::Program<Arc<anchor_client::solana_sdk::signature::Keypair>>) -> Result<Hash> {
    Ok(program.rpc().get_latest_blockhash()?)
}

/// Build place bet instructions for binary markets
pub fn build_place_bet_ixs(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
    side_yes: bool,
    amount_1e6: u64,
) -> Result<Vec<Instruction>> {
    let program = program(ctx)?;
    let mint = onchain::constants::USDC_MINT;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, b"yes");
    let (escrow_no, _) = pda_escrow_auth(&market_pda, b"no");
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

    let side = if side_yes {
        onchain::types::Side::Yes
    } else {
        onchain::types::Side::No
    };

    let ixs = program
        .request()
        .accounts(onchain::accounts::PlaceBet {
            user: user_pubkey,
            market: market_pda,
            mint,
            user_ata,
            position: position_pda,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
            rent: sysvar::rent::ID,
        })
        .args(onchain::instruction::PlaceBet {
            side,
            amount: amount_1e6,
        })
        .instructions()?;

    Ok(ixs)
}

/// Build place bet instructions for multi-outcome markets
pub fn build_place_bet_multi_ixs(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
    outcome_idx: u8,
    amount_1e6: u64,
) -> Result<Vec<Instruction>> {
    let program = program(ctx)?;
    let mint = onchain::constants::USDC_MINT;

    let (escrow_auth_outcome, _) = pda_escrow_auth_outcome(&market_pda, outcome_idx);
    let escrow_vault_for_outcome = get_associated_token_address(&escrow_auth_outcome, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position_multi(&market_pda, &user_pubkey, outcome_idx);

    let ixs = program
        .request()
        .accounts(onchain::accounts::PlaceBetMulti {
            user: user_pubkey,
            market: market_pda,
            mint,
            user_ata,
            escrow_authority_outcome: escrow_auth_outcome,
            escrow_vault_for_outcome,
            position: position_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
            rent: sysvar::rent::ID,
        })
        .args(onchain::instruction::PlaceBetMulti {
            outcome_idx,
            amount: amount_1e6,
        })
        .instructions()?;

    Ok(ixs)
}

/// Build unsigned place bet transaction for multi-outcome markets
pub fn build_place_bet_multi_unsigned(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
    outcome_idx: u8,
    amount_1e6: u64,
) -> Result<String> {
    let program = program(ctx)?;
    let ixs = build_place_bet_multi_ixs(ctx, user_pubkey, market_pda, outcome_idx, amount_1e6)?;
    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;
    encode_unsigned_tx(&tx)
}
