use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{ESCROW_SEED, OUTCOME_PREFIX, SIDE_NO, SIDE_YES},
    errors::ErrorCode,
    state::{Market, PositionBin, PositionMulti},
    types::{OracleKind, Side},
};

pub fn place_bet(ctx: Context<PlaceBet>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts.market.oracle_kind == OracleKind::Pyth as u8,
        ErrorCode::BadMarketType
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now < ctx.accounts.market.end_ts, ErrorCode::TooLateToBet);
    require!(!ctx.accounts.market.settled, ErrorCode::AlreadySettled);

    let (vault_ai, is_yes) = match side {
        Side::Yes => (&ctx.accounts.escrow_vault_yes, true),
        Side::No => (&ctx.accounts.escrow_vault_no, false),
    };

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: vault_ai.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let pos = &mut ctx.accounts.position;
    if pos.user == Pubkey::default() {
        pos.user = ctx.accounts.user.key();
        pos.market = ctx.accounts.market.key();
        pos.yes_bet = 0;
        pos.no_bet = 0;
        pos.claimed = false;
    }
    require_keys_eq!(pos.user, ctx.accounts.user.key(), ErrorCode::Unauthorized);
    require_keys_eq!(pos.market, ctx.accounts.market.key(), ErrorCode::Unauthorized);

    let m = &mut ctx.accounts.market;
    if is_yes {
        m.yes_total = m.yes_total.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        pos.yes_bet = pos.yes_bet.checked_add(amount).ok_or(ErrorCode::Overflow)?;
    } else {
        m.no_total = m.no_total.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        pos.no_bet = pos.no_bet.checked_add(amount).ok_or(ErrorCode::Overflow)?;
    }

    Ok(())
}

pub fn place_bet_multi(ctx: Context<PlaceBetMulti>, outcome_idx: u8, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    
    let m = &mut ctx.accounts.market;
    require!(m.oracle_kind == OracleKind::Ai as u8, ErrorCode::BadMarketType);
    require!(!m.settled, ErrorCode::AlreadySettled);
    require!(outcome_idx < m.num_outcomes, ErrorCode::BadMarketType);
    
    let now = Clock::get()?.unix_timestamp;
    require!(now < m.end_ts, ErrorCode::TooLateToBet);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.escrow_vault_for_outcome.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let idx = outcome_idx as usize;
    m.tvl_per_outcome[idx] = m.tvl_per_outcome[idx]
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    let pos = &mut ctx.accounts.position;
    if pos.user == Pubkey::default() {
        pos.user = ctx.accounts.user.key();
        pos.market = m.key();
        pos.outcome_idx = outcome_idx;
        pos.claimed = false;
        pos.stake = 0;
    }
    require_keys_eq!(pos.user, ctx.accounts.user.key(), ErrorCode::Unauthorized);
    require_keys_eq!(pos.market, m.key(), ErrorCode::Unauthorized);
    require!(pos.outcome_idx == outcome_idx, ErrorCode::Unauthorized);

    pos.stake = pos.stake.checked_add(amount).ok_or(ErrorCode::Overflow)?;
    
    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, constraint = !market.settled @ ErrorCode::AlreadySettled)]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA derived in constraint
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,
    
    /// CHECK: PDA derived in constraint
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_NO], bump)]
    pub escrow_authority_no: UncheckedAccount<'info>,

    #[account(mut, constraint = escrow_vault_yes.mint == mint.key())]
    pub escrow_vault_yes: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = escrow_vault_no.mint == mint.key())]
    pub escrow_vault_no: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = PositionBin::SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, PositionBin>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(outcome_idx: u8)]
pub struct PlaceBetMulti<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, constraint = !market.settled @ ErrorCode::AlreadySettled)]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA derived in constraint
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), OUTCOME_PREFIX, &[outcome_idx]], bump)]
    pub escrow_authority_outcome: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority_outcome
    )]
    pub escrow_vault_for_outcome: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = PositionMulti::SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome_idx]],
        bump
    )]
    pub position: Account<'info, PositionMulti>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}