use super::{
    context::{AnchorCtx, program},
    pda::{pda_market, pda_market_ai, pda_escrow_auth, pda_position, pda_config, SIDE_YES, SIDE_NO},
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

/// Get latest blockhash from program
fn latest_blockhash(program: &anchor_client::Program<Arc<anchor_client::solana_sdk::signature::Keypair>>) -> Result<Hash> {
    Ok(program.rpc().get_latest_blockhash()?)
}

/// Create market instruction
pub fn create_market(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    feed_id: [u8; 32],
    market_type: onchain::types::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
) -> Result<String> {
    let program = program(ctx)?;
    let mint = onchain::constants::USDC_MINT;

    let (market_pda, _) = pda_market(&user_pubkey, &feed_id, end_ts);
    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let (config_pda, _) = pda_config();

    let ixs = program
        .request()
        .accounts(onchain::accounts::CreateMarket {
            authority: user_pubkey,
            market: market_pda,
            mint,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            config: config_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::CreateMarket {
            market_type,
            comparator,
            bound_lo_usd_6,
            bound_hi_usd_6,
            end_ts,
            feed_id,
        })
        .instructions()?;

    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

/// Create market with optional seed bet in one transaction
pub fn build_create_and_seed(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    feed_id: [u8; 32],
    market_type: onchain::types::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
    seed_side: onchain::types::Side,
    seed_amount: u64,
    memo_opt: Option<&[u8]>,
    recent_blockhash: Hash,
) -> Result<String> {
    let program = program(ctx)?;
    let mint = onchain::constants::USDC_MINT;

    let (market_pda, _) = pda_market(&user_pubkey, &feed_id, end_ts);
    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);
    let (config_pda, _) = pda_config();

    // CreateMarket instruction
    let mut ixs = program
        .request()
        .accounts(onchain::accounts::CreateMarket {
            authority: user_pubkey,
            market: market_pda,
            mint,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            config: config_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::CreateMarket {
            market_type,
            comparator,
            bound_lo_usd_6,
            bound_hi_usd_6,
            end_ts,
            feed_id,
        })
        .instructions()?;

    // Optional seed bet
    if seed_amount > 0 {
        let mut place_ixs = program
            .request()
            .accounts(onchain::accounts::PlaceBet {
                user: user_pubkey,
                market: market_pda,
                mint,
                user_ata,
                escrow_authority_yes: escrow_yes,
                escrow_authority_no: escrow_no,
                escrow_vault_yes: vault_yes,
                escrow_vault_no: vault_no,
                position: position_pda,
                token_program: TOKEN_PROGRAM_ID,
                associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
                rent: sysvar::rent::ID,
            })
            .args(onchain::instruction::PlaceBet {
                side: seed_side,
                amount: seed_amount,
            })
            .instructions()?;

        ixs.append(&mut place_ixs);
    }

    // Optional memo
    if let Some(memo_bytes) = memo_opt {
        ixs.push(spl_memo::build_memo(memo_bytes, &[]));
    }

    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = recent_blockhash;

    encode_unsigned_tx(&tx)
}

/// Create AI binary market (unsigned transaction)
pub fn build_create_market_ai_binary_unsigned(
    ctx: &AnchorCtx,
    authority: Pubkey,
    end_ts: i64,
    ai_oracle_authority: Pubkey,
    memo_opt: Option<&str>,
) -> Result<(String, Pubkey)> {
    let program = program(ctx)?;
    let oracle_kind = onchain::types::OracleKind::Ai as u8;

    // Generate unique salt from current timestamp and nanos to prevent PDA collisions
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let mut salt = [0u8; 8];
    let timestamp_nanos = now.as_nanos() as u64;
    salt.copy_from_slice(&timestamp_nanos.to_le_bytes());

    let (market_pda, _) = pda_market_ai(&authority, end_ts, oracle_kind, &salt);
    let (config_pda, _) = pda_config();

    let ixs_main = program
        .request()
        .accounts(onchain::accounts::CreateMarketMulti {
            authority,
            market: market_pda,
            config: config_pda,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::CreateMarketMulti {
            p: onchain::instructions::market_create::CreateMarketMultiParams{
                oracle_kind,
                num_outcomes: 2,
                end_ts,
                ai_oracle_authority,
                salt,
            }
        })
        .instructions()?;

    let mut ixs: Vec<Instruction> = Vec::with_capacity(ixs_main.len() + 1);
    if let Some(memo) = memo_opt {
        ixs.push(spl_memo::build_memo(memo.as_bytes(), &[]));
    }
    ixs.extend(ixs_main);

    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&authority));
    tx.message.recent_blockhash = bh;

    let tx_b64 = encode_unsigned_tx(&tx)?;
    Ok((tx_b64, market_pda))
}