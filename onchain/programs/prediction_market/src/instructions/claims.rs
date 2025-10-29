use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{ESCROW_SEED, SIDE_NO, SIDE_YES},
    errors::ErrorCode,
    state::{Market, PositionBin, PositionMulti},
    types::OracleKind,
    utils::{escrow_signer_seeds, mul_div_u64, outcome_signer_seeds, pda_escrow_auth_outcome},
};

pub fn claim(ctx: Context<Claim>) -> Result<()> {
    let m = &ctx.accounts.market;
    require!(m.oracle_kind == OracleKind::Pyth as u8, ErrorCode::BadMarketType);
    require!(m.settled, ErrorCode::MarketNotResolved);

    let pos = &mut ctx.accounts.position;
    require!(!pos.claimed, ErrorCode::AlreadyClaimed);

    let market_key = m.key();

    if m.winning_side == 3 {
        // VOID - refund 1:1
        return handle_void_refund(ctx, market_key);
    }

    let (user_side_amt, total_side_amt, win_side, win_bump, win_vault, win_auth_ai) =
        match m.winning_side {
            1 => (
                pos.yes_bet,
                m.yes_total,
                SIDE_YES,
                ctx.bumps.escrow_authority_yes,
                &ctx.accounts.escrow_vault_yes,
                ctx.accounts.escrow_authority_yes.to_account_info(),
            ),
            2 => (
                pos.no_bet,
                m.no_total,
                SIDE_NO,
                ctx.bumps.escrow_authority_no,
                &ctx.accounts.escrow_vault_no,
                ctx.accounts.escrow_authority_no.to_account_info(),
            ),
            _ => return Err(error!(ErrorCode::MarketNotResolved)),
        };

    require!(user_side_amt > 0, ErrorCode::NoWinningBet);

    let win_bump_arr = [win_bump];
    let seeds = escrow_signer_seeds(&market_key, win_side, &win_bump_arr);

    let payout = mul_div_u64(m.payout_pool, user_side_amt, total_side_amt)?;
    if payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: win_vault.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                    authority: win_auth_ai,
                },
                &[&seeds],
            ),
            payout,
        )?;
    }
    
    pos.claimed = true;
    Ok(())
}

fn handle_void_refund(ctx: Context<Claim>, market_key: Pubkey) -> Result<()> {
    let pos = &mut ctx.accounts.position;

    if pos.yes_bet > 0 {
        let bump_yes = ctx.bumps.escrow_authority_yes;
        let bump_yes_arr = [bump_yes];
        let seeds_yes = escrow_signer_seeds(&market_key, SIDE_YES, &bump_yes_arr);
        let amt_yes = core::cmp::min(pos.yes_bet, ctx.accounts.escrow_vault_yes.amount);
        
        if amt_yes > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault_yes.to_account_info(),
                        to: ctx.accounts.user_ata.to_account_info(),
                        authority: ctx.accounts.escrow_authority_yes.to_account_info(),
                    },
                    &[&seeds_yes],
                ),
                amt_yes,
            )?;
        }
    }
    
    if pos.no_bet > 0 {
        let bump_no = ctx.bumps.escrow_authority_no;
        let bump_no_arr = [bump_no];
        let seeds_no = escrow_signer_seeds(&market_key, SIDE_NO, &bump_no_arr);
        let amt_no = core::cmp::min(pos.no_bet, ctx.accounts.escrow_vault_no.amount);
        
        if amt_no > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault_no.to_account_info(),
                        to: ctx.accounts.user_ata.to_account_info(),
                        authority: ctx.accounts.escrow_authority_no.to_account_info(),
                    },
                    &[&seeds_no],
                ),
                amt_no,
            )?;
        }
    }
    
    pos.claimed = true;
    Ok(())
}

pub fn claim_multi(ctx: Context<ClaimMulti>, outcome_idx: u8) -> Result<()> {
    let m = &ctx.accounts.market;
    require!(m.oracle_kind == OracleKind::Ai as u8, ErrorCode::BadMarketType);
    require!(m.settled, ErrorCode::MarketNotResolved);

    let pos = &mut ctx.accounts.position;
    require!(!pos.claimed, ErrorCode::AlreadyClaimed);
    require!(pos.outcome_idx == outcome_idx, ErrorCode::NoWinningBet);

    // Check if user is winner
    let is_single = m.winners_mask == 0 && m.outcome_idx != u8::MAX;
    let user_is_winner = if is_single {
        m.outcome_idx == outcome_idx
    } else {
        (m.winners_mask & (1 << outcome_idx)) != 0
    };
    require!(user_is_winner, ErrorCode::NoWinningBet);

    // Verify win authority PDA
    let market_key = m.key();
    let (win_pda, bump) = pda_escrow_auth_outcome(&market_key, outcome_idx, ctx.program_id);
    require_keys_eq!(win_pda, ctx.accounts.win_authority.key(), ErrorCode::Unauthorized);
    require_keys_eq!(ctx.accounts.win_vault.owner, win_pda, ErrorCode::Unauthorized);
    require_keys_eq!(ctx.accounts.win_vault.mint, ctx.accounts.mint.key(), ErrorCode::WrongMint);

    let total = m.tvl_per_outcome[outcome_idx as usize];
    require!(total > 0, ErrorCode::NoWinningBet);

    // Determine payout pool
    let pool_u64 = if is_single {
        core::cmp::min(m.payout_pool, ctx.accounts.win_vault.amount)
    } else {
        ctx.accounts.win_vault.amount
    };

    // Calculate proportional payout
    let payout = mul_div_u64(pool_u64, pos.stake, total)?;
    if payout > 0 {
        let outcome_idx_arr = [outcome_idx];
        let bump_arr = [bump];
        let seeds = outcome_signer_seeds(&market_key, &outcome_idx_arr, &bump_arr);
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.win_vault.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                    authority: ctx.accounts.win_authority.to_account_info(),
                },
                &[&seeds],
            ),
            payout,
        )?;
    }
    
    pos.claimed = true;
    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, PositionBin>,

    /// CHECK: PDA
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,
    
    /// CHECK: PDA
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_NO], bump)]
    pub escrow_authority_no: UncheckedAccount<'info>,

    #[account(mut, constraint = escrow_vault_yes.mint == mint.key())]
    pub escrow_vault_yes: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = escrow_vault_no.mint == mint.key())]
    pub escrow_vault_no: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome_idx: u8)]
pub struct ClaimMulti<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref(), &[outcome_idx]],
        bump
    )]
    pub position: Account<'info, PositionMulti>,

    /// CHECK: PDA verified in instruction
    pub win_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub win_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}