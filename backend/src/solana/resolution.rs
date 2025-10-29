use super::{
    context::{AnchorCtx, program},
    pda::{pda_market, pda_escrow_auth, pda_escrow_auth_outcome, pda_position, SIDE_YES, SIDE_NO},
    encoding::{encode_unsigned_tx, decode_oracle_secret_32},
    accounts::get_market_account,
    attestation::{build_message_single_client},
};
use crate::{types::ix::{IxAccountMetaJson, IxJson, ResolveIxBundle}, state};
use anchor_client::solana_sdk::{
    pubkey::Pubkey,
    instruction::{Instruction, AccountMeta},
    transaction::Transaction,
    commitment_config::CommitmentConfig,
    system_program, sysvar, hash::Hash,
    signature::{Signature, Signer},
    ed25519_instruction::new_ed25519_instruction_with_signature,
};
use anchor_spl::{
    token::ID as TOKEN_PROGRAM_ID,
    associated_token::{ID as ASSOCIATED_TOKEN_PROGRAM_ID, get_associated_token_address},
};
use spl_associated_token_account::instruction as ata_ix;
use anyhow::{Context, Result};
use base64::{Engine, engine::general_purpose};
use std::sync::Arc;
use ed25519_dalek::{SigningKey, Signer as DalekSigner};
use prediction_market_program as onchain;

/// Get latest blockhash
fn latest_blockhash(program: &anchor_client::Program<Arc<anchor_client::solana_sdk::signature::Keypair>>) -> Result<Hash> {
    Ok(program.rpc().get_latest_blockhash()?)
}

/// Ensure ATA exists, create if needed
pub fn ensure_ata_exists(
    program: &anchor_client::Program<Arc<anchor_client::solana_sdk::signature::Keypair>>,
    ixs: &mut Vec<Instruction>,
    owner: &Pubkey,
    mint: &Pubkey,
    payer: &Pubkey,
) -> Result<Pubkey> {
    let ata = get_associated_token_address(owner, mint);

    let need_create = program
        .rpc()
        .get_account_with_commitment(&ata, CommitmentConfig::processed())?
        .value
        .is_none();

    if need_create {
        ixs.push(ata_ix::create_associated_token_account(
            payer, owner, mint, &TOKEN_PROGRAM_ID,
        ));
    }

    Ok(ata)
}

/// Build resolve market transaction for Pyth oracle
pub fn build_resolve(
    ctx: &AnchorCtx,
    resolver_pubkey: Pubkey,
    market_authority: Pubkey,
    feed_id: [u8; 32],
    end_ts: i64,
    price_update: Pubkey,
) -> Result<String> {
    let state = state::global();
    let program = program(ctx)?;
    let mint = state.usdc_mint.parse()?;

    let (market_pda, _) = pda_market(&market_authority, &feed_id, end_ts);
    let market_acc: onchain::state::Market = program.account(market_pda)?;
    let treasury_owner = market_acc.treasury_wallet_snapshot;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let resolver_ata = get_associated_token_address(&resolver_pubkey, &mint);
    let treasury_ata = get_associated_token_address(&treasury_owner, &mint);

    let mut ixs: Vec<Instruction> = Vec::new();

    // Create treasury ATA if needed
    let need_treasury_ata = program
        .rpc()
        .get_account_with_commitment(&treasury_ata, CommitmentConfig::processed())?
        .value
        .is_none();

    if need_treasury_ata {
        ixs.push(ata_ix::create_associated_token_account(
            &resolver_pubkey,
            &treasury_owner,
            &mint,
            &TOKEN_PROGRAM_ID,
        ));
    }

    // ResolveMarket instruction
    let mut resolve_ixs = program
        .request()
        .accounts(onchain::accounts::ResolveMarket {
            market: market_pda,
            price_update,
            resolver: resolver_pubkey,
            resolver_ata,
            mint,
            treasury_ata,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::ResolveMarket {})
        .instructions()?;

    ixs.append(&mut resolve_ixs);

    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&resolver_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

/// Convert instruction to JSON format
fn ix_to_json(ix: Instruction) -> IxJson {
    IxJson {
        program_id: ix.program_id.to_string(),
        accounts: ix
            .accounts
            .into_iter()
            .map(|m| IxAccountMetaJson {
                pubkey: m.pubkey.to_string(),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data_b64: general_purpose::STANDARD.encode(ix.data),
    }
}

/// Build resolve instruction bundle for Pyth price injection
pub fn build_resolve_ix_bundle(
    ctx: &AnchorCtx,
    resolver_pubkey: Pubkey,
    market_pda: Pubkey,
) -> Result<ResolveIxBundle> {
    let program = program(ctx)?;
    let mint: Pubkey = onchain::constants::USDC_MINT;
    
    let market_acc: onchain::state::Market = program.account(market_pda)?;
    if market_acc.settled {
        anyhow::bail!("market already settled");
    }

    let feed_id_hex = format!("0x{}", hex::encode(market_acc.feed_id));
    let end_ts = market_acc.end_ts;
    let treasury_owner = market_acc.treasury_wallet_snapshot;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let resolver_ata = get_associated_token_address(&resolver_pubkey, &mint);
    let treasury_ata = get_associated_token_address(&treasury_owner, &mint);

    let mut out: Vec<IxJson> = vec![];

    // Create treasury ATA if needed
    let need_treasury_ata = program
        .rpc()
        .get_account_with_commitment(&treasury_ata, CommitmentConfig::processed())?
        .value
        .is_none();
    
    if need_treasury_ata {
        let create_ata_ix = ata_ix::create_associated_token_account(
            &resolver_pubkey,
            &treasury_owner,
            &mint,
            &TOKEN_PROGRAM_ID,
        );
        out.push(ix_to_json(create_ata_ix));
    }

    // ResolveMarket instruction with placeholder price_update
    let price_update_placeholder = Pubkey::default();
    let accounts = vec![
        AccountMeta::new(market_pda, false),
        AccountMeta::new_readonly(price_update_placeholder, false),
        AccountMeta::new(resolver_pubkey, true),
        AccountMeta::new(resolver_ata, false),
        AccountMeta::new_readonly(mint, false),
        AccountMeta::new(treasury_ata, false),
        AccountMeta::new_readonly(escrow_yes, false),
        AccountMeta::new_readonly(escrow_no, false),
        AccountMeta::new(vault_yes, false),
        AccountMeta::new(vault_no, false),
        AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        AccountMeta::new_readonly(ASSOCIATED_TOKEN_PROGRAM_ID, false),
        AccountMeta::new_readonly(system_program::ID, false),
    ];

    let data = anchor_client::anchor_lang::InstructionData::data(&onchain::instruction::ResolveMarket {});
    let resolve_ix = Instruction {
        program_id: onchain::ID,
        accounts,
        data,
    };
    out.push(ix_to_json(resolve_ix));

    Ok(ResolveIxBundle {
        ok: true,
        market_id: market_pda.to_string(),
        end_ts,
        feed_id_hex,
        price_update_index: 1,
        instructions: out,
        message: "Resolve ix bundle; inject price_update and send with Pyth Receiver".into(),
    })
}

/// Build claim winnings instruction
pub fn build_claim_ix(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
) -> Result<String> {
    let program = program(ctx)?;
    let mint = onchain::constants::USDC_MINT;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

    let ixs = program
        .request()
        .accounts(onchain::accounts::Claim {
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
        })
        .args(onchain::instruction::Claim {})
        .instructions()?;

    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;
    encode_unsigned_tx(&tx)
}

/// AI propose transaction (signed by backend)
pub fn ai_propose_prepare(
    state: &crate::state::SharedState,
    market_pda: Pubkey,
    outcome_idx: u8,
) -> Result<Signature> {
    let ctx = state.anchor.clone();
    let program = program(ctx.as_ref())?;
    let payer = &*ctx.payer;

    let market_acc = get_market_account(ctx.as_ref(), market_pda)
        .context("market account fetch failed")?;
    let end_ts = market_acc.end_ts;
    let oracle_pubkey_bytes: [u8; 32] = market_acc.ai_oracle_authority.to_bytes();

    let attest_ts = time::OffsetDateTime::now_utc().unix_timestamp();
    let nonce: u64 = (attest_ts as u64)
        ^ u64::from_le_bytes(market_pda.to_bytes()[..8].try_into().unwrap());

    let oracle_secret_env = std::env::var("AI_ORACLE_SECRET")
        .context("AI_ORACLE_SECRET is not set")?;
    let oracle_secret_seed32 = decode_oracle_secret_32(&oracle_secret_env)?;

    let message = build_message_single_client(
        &market_pda,
        outcome_idx,
        end_ts,
        attest_ts,
        nonce,
        &onchain::ID,
    );

    let sk = SigningKey::from_bytes(&oracle_secret_seed32);
    anyhow::ensure!(
        sk.verifying_key().to_bytes() == oracle_pubkey_bytes,
        "AI_ORACLE_SECRET doesn't match on-chain ai_oracle_authority"
    );

    let sig_bytes = sk.sign(&message).to_bytes();
    let ed_ix = new_ed25519_instruction_with_signature(&message, &sig_bytes, &oracle_pubkey_bytes);

    let mut ixs = vec![ed_ix];
    let mut propose_ixs = program
        .request()
        .accounts(onchain::accounts::ResolveAiPropose {
            market: market_pda,
            ix_sysvar: sysvar::instructions::ID,
        })
        .args(onchain::instruction::ResolveAiPropose {})
        .instructions()?;
    ixs.append(&mut propose_ixs);

    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&payer.pubkey()));
    tx.sign(&[payer], bh);

    let sig = program
        .rpc()
        .send_and_confirm_transaction(&tx)
        .context("send_and_confirm ResolveAiPropose tx failed")?;

    Ok(sig)
}

/// Build AI finalize transaction for single winner
pub fn build_ai_finalize_single_tx(
    ctx: &AnchorCtx,
    payer: Pubkey,
    market_pda: Pubkey,
    mint: Pubkey,
    treasury_owner: Pubkey,
    creator: Pubkey,
    win_idx: u8,
    losers: &[(u8, Pubkey, Pubkey)],
) -> Result<String> {
    let program = program(ctx)?;
    let mut ixs: Vec<Instruction> = Vec::new();

    let treasury_ata = ensure_ata_exists(&program, &mut ixs, &treasury_owner, &mint, &payer)?;
    let resolver_ata = ensure_ata_exists(&program, &mut ixs, &payer, &mint, &payer)?;
    let creator_ata = ensure_ata_exists(&program, &mut ixs, &creator, &mint, &payer)?;

    let (win_auth, _) = pda_escrow_auth_outcome(&market_pda, win_idx);
    let win_vault = get_associated_token_address(&win_auth, &mint);

    let mut req = program
        .request()
        .accounts(onchain::accounts::FinalizeAi {
            market: market_pda,
            resolver_ata,
            creator_ata,
            mint,
            treasury_ata,
            win_authority: win_auth,
            win_vault,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::FinalizeAi {});

    // Add losing outcome accounts
    for &(_, lose_auth, lose_vault) in losers {
        req = req.accounts(AccountMeta::new_readonly(lose_auth, false));
        req = req.accounts(AccountMeta::new(lose_vault, false));
    }

    let mut tail = req.instructions()?;
    ixs.append(&mut tail);

    let bh = program.rpc().get_latest_blockhash()?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&payer));
    tx.message.recent_blockhash = bh;
    encode_unsigned_tx(&tx)
}

/// Build AI finalize transaction for multiple winners
pub fn build_ai_finalize_multi_tx(
    ctx: &AnchorCtx,
    payer: Pubkey,
    market_pda: Pubkey,
    mint: Pubkey,
    treasury_owner: Pubkey,
    creator: Pubkey,
    all_outcomes: &[(u8, Pubkey, Pubkey)],
) -> Result<String> {
    let program = program(ctx)?;
    let mut ixs: Vec<Instruction> = Vec::new();

    let treasury_ata = ensure_ata_exists(&program, &mut ixs, &treasury_owner, &mint, &payer)?;
    let resolver_ata = ensure_ata_exists(&program, &mut ixs, &payer, &mint, &payer)?;
    let creator_ata = ensure_ata_exists(&program, &mut ixs, &creator, &mint, &payer)?;

    let first_idx = all_outcomes
        .first()
        .ok_or_else(|| anyhow::anyhow!("all_outcomes empty"))?
        .0;
    
    let (win_authority, _) = pda_escrow_auth_outcome(&market_pda, first_idx);
    let win_vault = get_associated_token_address(&win_authority, &mint);

    let mut req = program
        .request()
        .accounts(onchain::accounts::FinalizeAi {
            market: market_pda,
            resolver_ata,
            creator_ata,
            mint,
            treasury_ata,
            win_authority,
            win_vault,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::FinalizeAi {});

    // Add all outcome accounts
    for &(_, auth, vault) in all_outcomes {
        req = req.accounts(AccountMeta::new_readonly(auth, false));
        req = req.accounts(AccountMeta::new(vault, false));
    }

    let mut tail = req.instructions()?;
    ixs.append(&mut tail);

    let bh = program.rpc().get_latest_blockhash()?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&payer));
    tx.message.recent_blockhash = bh;
    encode_unsigned_tx(&tx)
}

/// Finalize AI market (determines single vs multi winner)
pub fn finalize_ai_unsigned(
    ctx: &AnchorCtx,
    payer: Pubkey,
    market_pda: Pubkey,
) -> Result<String> {
    let market = get_market_account(ctx, market_pda)?;

    if !market.tentative {
        anyhow::bail!("market is not tentative");
    }
    if market.settled {
        anyhow::bail!("market already settled");
    }

    let mint = onchain::constants::USDC_MINT;
    let treasury_owner = market.treasury_wallet_snapshot;
    let creator = market.authority;

    let is_single = market.winners_mask == 0 && market.outcome_idx != u8::MAX;
    
    if is_single {
        let win_idx = market.outcome_idx;
        let mut losers: Vec<(u8, Pubkey, Pubkey)> = Vec::new();
        
        for idx in 0..market.num_outcomes {
            if idx == win_idx {
                continue;
            }
            let (auth_pda, _) = pda_escrow_auth_outcome(&market_pda, idx);
            let vault_ata = get_associated_token_address(&auth_pda, &mint);
            losers.push((idx, auth_pda, vault_ata));
        }
        
        build_ai_finalize_single_tx(
            ctx, payer, market_pda, mint, treasury_owner, creator, win_idx, &losers,
        )
    } else {
        let mut all_outcomes: Vec<(u8, Pubkey, Pubkey)> =
            Vec::with_capacity(market.num_outcomes as usize);

        for idx in 0..market.num_outcomes {
            let (auth_pda, _) = pda_escrow_auth_outcome(&market_pda, idx);
            let vault_ata = get_associated_token_address(&auth_pda, &mint);
            all_outcomes.push((idx, auth_pda, vault_ata));
        }

        build_ai_finalize_multi_tx(
            ctx, payer, market_pda, mint, treasury_owner, creator, &all_outcomes,
        )
    }
}