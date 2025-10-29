use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    constants::{
        ESCROW_SEED, MAX_PRICE_STALENESS, PRICE_FETCH_GRACE_PERIOD,
        RESOLVE_HORIZON_SECS, SIDE_NO, SIDE_YES,
    },
    errors::ErrorCode,
    events::MarketResolved,
    state::Market,
    types::OracleKind,
    utils::{cmp_check, escrow_signer_seeds, mul_div_bps_u128, price_to_usd_1e6_from_pyth},
};

pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
    let market_key = ctx.accounts.market.key();
    let m = &mut ctx.accounts.market;
    
    require!(m.oracle_kind == OracleKind::Pyth as u8, ErrorCode::BadMarketType);
    require!(!m.settled, ErrorCode::AlreadySettled);
    
    let now = Clock::get()?.unix_timestamp;
    require!(now >= m.end_ts, ErrorCode::TooEarly);

    ctx.accounts.escrow_vault_yes.reload()?;
    ctx.accounts.escrow_vault_no.reload()?;
    let yes_amt_u64 = ctx.accounts.escrow_vault_yes.amount;
    let no_amt_u64 = ctx.accounts.escrow_vault_no.amount;

    // Check for void conditions
    if yes_amt_u64 == 0 || no_amt_u64 == 0 {
        return resolve_as_void(m, market_key);
    }

    if now - m.end_ts > RESOLVE_HORIZON_SECS {
        return resolve_as_void(m, market_key);
    }

    // Fetch Pyth price
    let max_age_i64 = (now - m.end_ts) + PRICE_FETCH_GRACE_PERIOD;
    let max_age: u64 = max_age_i64.try_into().unwrap_or(u64::MAX);

    let price = ctx
        .accounts
        .price_update
        .get_price_no_older_than(&Clock::get()?, max_age, &m.feed_id)
        .map_err(|_| error!(ErrorCode::InvalidPriceFeed))?;

    let pt = price.publish_time;
    require!(pt >= m.end_ts, ErrorCode::StalePrice);
    require!(pt - m.end_ts <= MAX_PRICE_STALENESS, ErrorCode::StalePrice);

    let price_1e6 = price_to_usd_1e6_from_pyth(price.price, price.exponent)?;
    m.resolved_price_1e6 = price_1e6;

    // Determine winner
    let yes_is_true = match m.market_type {
        0 => cmp_check(m.comparator, price_1e6, m.bound_lo)?,
        1 => (price_1e6 >= m.bound_lo) && (price_1e6 <= m.bound_hi),
        _ => return Err(error!(ErrorCode::BadMarketType)),
    };
    
    let winner_is_yes = yes_is_true;
    m.winning_side = if winner_is_yes { 1 } else { 2 };

    let total_winners = if winner_is_yes { m.yes_total } else { m.no_total };
    if total_winners == 0 {
        return resolve_as_void(m, market_key);
    }

    // Calculate fees
    let yes_amt = yes_amt_u64 as u128;
    let no_amt = no_amt_u64 as u128;
    let pot_u128 = yes_amt.checked_add(no_amt).ok_or(error!(ErrorCode::Overflow))?;
    
    let fee_u128 = mul_div_bps_u128(pot_u128, m.fee_bps_snapshot as u128)?;
    let tip_u128 = mul_div_bps_u128(pot_u128, m.resolver_bps_snapshot as u128)?;
    let payout_pool_u128 = pot_u128
        .checked_sub(fee_u128)
        .ok_or(error!(ErrorCode::Overflow))?
        .checked_sub(tip_u128)
        .ok_or(error!(ErrorCode::Overflow))?;

    let bump_yes = ctx.bumps.escrow_authority_yes;
    let bump_no = ctx.bumps.escrow_authority_no;

    let bump_yes_arr = [bump_yes];
    let bump_no_arr = [bump_no];

    let seeds_yes = escrow_signer_seeds(&market_key, SIDE_YES, &bump_yes_arr);
    let seeds_no = escrow_signer_seeds(&market_key, SIDE_NO, &bump_no_arr);

    // Transfer losing side to winning side
    if winner_is_yes && no_amt_u64 > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault_no.to_account_info(),
                    to: ctx.accounts.escrow_vault_yes.to_account_info(),
                    authority: ctx.accounts.escrow_authority_no.to_account_info(),
                },
                &[&seeds_no],
            ),
            no_amt_u64,
        )?;
    } else if !winner_is_yes && yes_amt_u64 > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault_yes.to_account_info(),
                    to: ctx.accounts.escrow_vault_no.to_account_info(),
                    authority: ctx.accounts.escrow_authority_yes.to_account_info(),
                },
                &[&seeds_yes],
            ),
            yes_amt_u64,
        )?;
    }

    let (win_vault, win_auth, win_side, win_bump) = if winner_is_yes {
        (
            &ctx.accounts.escrow_vault_yes,
            &ctx.accounts.escrow_authority_yes,
            SIDE_YES,
            bump_yes,
        )
    } else {
        (
            &ctx.accounts.escrow_vault_no,
            &ctx.accounts.escrow_authority_no,
            SIDE_NO,
            bump_no,
        )
    };

    let tip_u64: u64 = tip_u128.try_into().map_err(|_| error!(ErrorCode::Overflow))?;
    let fee_u64: u64 = fee_u128.try_into().map_err(|_| error!(ErrorCode::Overflow))?;

    require_keys_eq!(ctx.accounts.resolver_ata.mint, ctx.accounts.mint.key());
    require_keys_eq!(ctx.accounts.treasury_ata.mint, ctx.accounts.mint.key());

    let win_bump_arr = [win_bump];
    let win_seeds = escrow_signer_seeds(&market_key, win_side, &win_bump_arr);

    // Pay resolver tip
    if tip_u64 > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: win_vault.to_account_info(),
                    to: ctx.accounts.resolver_ata.to_account_info(),
                    authority: win_auth.to_account_info(),
                },
                &[&win_seeds],
            ),
            tip_u64,
        )?;
    }
    
    // Pay protocol fee
    if fee_u64 > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: win_vault.to_account_info(),
                    to: ctx.accounts.treasury_ata.to_account_info(),
                    authority: win_auth.to_account_info(),
                },
                &[&win_seeds],
            ),
            fee_u64,
        )?;
    }

    // Calculate final payout pool
    if winner_is_yes {
        ctx.accounts.escrow_vault_yes.reload()?;
        let remain = ctx.accounts.escrow_vault_yes.amount;
        let pp_u64: u64 = payout_pool_u128.try_into().unwrap_or(u64::MAX);
        m.payout_pool = core::cmp::min(pp_u64, remain);
    } else {
        ctx.accounts.escrow_vault_no.reload()?;
        let remain = ctx.accounts.escrow_vault_no.amount;
        let pp_u64: u64 = payout_pool_u128.try_into().unwrap_or(u64::MAX);
        m.payout_pool = core::cmp::min(pp_u64, remain);
    }

    m.settled = true;
    
    emit!(MarketResolved {
        market: market_key,
        winning_side: m.winning_side,
        resolved_price_1e6: m.resolved_price_1e6,
        pot: pot_u128,
        fee: fee_u128,
        tip: tip_u128,
        payout_pool: m.payout_pool as u128,
    });
    
    Ok(())
}

fn resolve_as_void(m: &mut Market, market_key: Pubkey) -> Result<()> {
    m.winning_side = 3; // VOID
    m.payout_pool = 0;
    m.settled = true;
    
    emit!(MarketResolved {
        market: market_key,
        winning_side: m.winning_side,
        resolved_price_1e6: m.resolved_price_1e6,
        pot: 0,
        fee: 0,
        tip: 0,
        payout_pool: 0,
    });
    
    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    pub price_update: Account<'info, PriceUpdateV2>,

    #[account(mut)]
    pub resolver: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = mint,
        associated_token::authority = resolver
    )]
    pub resolver_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = treasury_ata.mint == mint.key(),
        constraint = treasury_ata.owner == market.treasury_wallet_snapshot
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

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