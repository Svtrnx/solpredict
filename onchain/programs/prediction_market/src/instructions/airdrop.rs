use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::{
    instructions::CreateMetadataAccountV3CpiBuilder,
    types::DataV2,
    ID as TOKEN_METADATA_PROGRAM_ID,
};

use crate::{
    constants::{AIRDROP_AMOUNT, USDC_MINT},
    errors::AirdropError,
    events::Airdropped,
    state::AirdropClaim,
};

pub fn airdrop_once(ctx: Context<AirdropOnce>) -> Result<()> {
    require_keys_eq!(ctx.accounts.mint.key(), USDC_MINT, AirdropError::WrongMint);
    require!(!ctx.accounts.claim.claimed, AirdropError::AlreadyClaimed);

    let bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[b"mint-auth", &[bump]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        AIRDROP_AMOUNT,
    )?;

    ctx.accounts.claim.claimed = true;
    ctx.accounts.claim.when = Clock::get()?.unix_timestamp;

    emit!(Airdropped {
        user: ctx.accounts.user.key(),
        ata: ctx.accounts.user_ata.key(),
        amount: AIRDROP_AMOUNT,
    });

    Ok(())
}

pub fn set_metadata(ctx: Context<SetMetadata>, uri: String) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.token_metadata_program.key(),
        TOKEN_METADATA_PROGRAM_ID,
        AirdropError::WrongMint
    );
    
    let (expected_md, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            ctx.accounts.mint.key().as_ref(),
        ],
        &TOKEN_METADATA_PROGRAM_ID,
    );
    require_keys_eq!(ctx.accounts.metadata.key(), expected_md, AirdropError::WrongMint);

    let data = DataV2 {
        name: "USDC Predict".to_string(),
        symbol: "$".to_string(),
        uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    // Get AccountInfo references
    let tm_prog_ai = ctx.accounts.token_metadata_program.to_account_info();
    let metadata_ai = ctx.accounts.metadata.to_account_info();
    let mint_ai = ctx.accounts.mint.to_account_info();
    let mint_auth_ai = ctx.accounts.mint_authority.to_account_info();
    let payer_ai = ctx.accounts.payer.to_account_info();
    let sys_ai = ctx.accounts.system_program.to_account_info();
    let rent_ai = ctx.accounts.rent.to_account_info();

    let bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[b"mint-auth", &[bump]];

    let mut cpi = CreateMetadataAccountV3CpiBuilder::new(&tm_prog_ai);
    cpi.metadata(&metadata_ai);
    cpi.mint(&mint_ai);
    cpi.mint_authority(&mint_auth_ai);
    cpi.payer(&payer_ai);
    cpi.update_authority(&mint_auth_ai, true);
    cpi.system_program(&sys_ai);
    cpi.rent(Some(&rent_ai));
    cpi.data(data);
    cpi.is_mutable(true);

    cpi.invoke_signed(&[signer_seeds])?;
    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct AirdropOnce<'info> {
    /// CHECK: User receiving airdrop
    pub user: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA
    #[account(seeds = [b"mint-auth"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + AirdropClaim::SIZE,
        seeds = [b"claim", user.key().as_ref()],
        bump
    )]
    pub claim: Account<'info, AirdropClaim>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMetadata<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA
    #[account(seeds = [b"mint-auth"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex Token Metadata program
    pub token_metadata_program: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}