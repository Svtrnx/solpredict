use super::{
    context::{AnchorCtx, program},
    pda::{pda_config, pda_mint_auth, pda_claim},
};
use anchor_client::solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signature, Signer},
    system_program, sysvar,
};
use anchor_spl::{
    token::ID as TOKEN_PROGRAM_ID,
    associated_token::{ID as ASSOCIATED_TOKEN_PROGRAM_ID, get_associated_token_address},
};
use anyhow::Result;
use std::str::FromStr;
use prediction_market_program as onchain;

/// Initialize config account
pub fn init_config(
    ctx: &AnchorCtx,
    admin: &Keypair,
    treasury_wallet: Pubkey,
    fee_bps: u16,
    resolver_bps: u16,
    creator_bps: u16,
    resolver_tip_cap: u64,
) -> Result<Signature> {
    let program = program(ctx)?;
    let (config_pda, _) = pda_config();
    
    let sig = program
        .request()
        .accounts(onchain::accounts::InitConfig {
            admin: admin.pubkey(),
            treasury_wallet,
            config: config_pda,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::InitConfig {
            fee_bps,
            resolver_bps,
            creator_bps,
            resolver_tip_cap,
        })
        .signer(admin)
        .send()?;
    
    Ok(sig)
}

/// Update config parameters
pub fn update_config(
    ctx: &AnchorCtx,
    admin: &Keypair,
    fee_bps: Option<u16>,
    resolver_bps: Option<u16>,
    creator_bps: Option<u16>,
    resolver_tip_cap: Option<u64>,
    new_treasury: Option<Pubkey>,
) -> Result<Signature> {
    let program = program(ctx)?;
    let (config_pda, _) = pda_config();
    
    let sig = program
        .request()
        .accounts(onchain::accounts::UpdateConfig {
            admin: admin.pubkey(),
            config: config_pda,
        })
        .args(onchain::instruction::UpdateConfig {
            fee_bps,
            resolver_bps,
            creator_bps,
            resolver_tip_cap,
            new_treasury,
        })
        .signer(admin)
        .send()?;
    
    Ok(sig)
}

/// Airdrop USDC once per user (devnet only)
pub fn airdrop_usdc_once(ctx: &AnchorCtx, user: Pubkey) -> Result<Signature> {
    let state = crate::state::global();
    let program = program(ctx)?;
    let mint = Pubkey::from_str(&state.usdc_mint)?;

    let (mint_auth_pda, _) = pda_mint_auth();
    let (claim_pda, _) = pda_claim(&user);
    let user_ata = get_associated_token_address(&user, &mint);

    let sig = program
        .request()
        .accounts(onchain::accounts::AirdropOnce {
            user,
            payer: ctx.payer.pubkey(),
            mint,
            mint_authority: mint_auth_pda,
            user_ata,
            claim: claim_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::AirdropOnce {})
        .signer(&*ctx.payer)
        .send()?;

    Ok(sig)
}

/// Set token metadata for USDC mint (Metaplex)
pub fn set_token_metadata(ctx: &AnchorCtx, uri: &str) -> Result<Signature> {
    let state = crate::state::global();
    let program = program(ctx)?;
    let mint = Pubkey::from_str(&state.usdc_mint)?;
    let (mint_auth_pda, _) = pda_mint_auth();

    // Metaplex Token Metadata program
    let tm_prog: Pubkey = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        .parse()
        .unwrap();

    // Metadata PDA
    let (metadata_pda, _) = Pubkey::find_program_address(
        &[b"metadata", tm_prog.as_ref(), mint.as_ref()],
        &tm_prog,
    );

    let sig = program
        .request()
        .accounts(onchain::accounts::SetMetadata {
            payer: ctx.payer.pubkey(),
            mint,
            mint_authority: mint_auth_pda,
            metadata: metadata_pda,
            token_metadata_program: tm_prog,
            system_program: system_program::ID,
            rent: sysvar::rent::ID,
        })
        .args(onchain::instruction::SetMetadata {
            uri: uri.to_string(),
        })
        .signer(&*ctx.payer)
        .send()?;

    Ok(sig)
}