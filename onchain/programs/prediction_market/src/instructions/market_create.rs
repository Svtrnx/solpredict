use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::{ESCROW_SEED, MAX_OUTCOMES, SIDE_NO, SIDE_YES, USDC_MINT},
    errors::ErrorCode,
    state::{Config, Market},
    types::{MarketType, OracleKind},
};

pub fn create_market(
    ctx: Context<CreateMarket>,
    market_type: MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
    feed_id: [u8; 32],
) -> Result<()> {
    require_keys_eq!(ctx.accounts.mint.key(), USDC_MINT, ErrorCode::WrongMint);

    let cfg = &ctx.accounts.config;
    let m = &mut ctx.accounts.market;
    
    m.authority = ctx.accounts.authority.key();
    m.oracle_kind = OracleKind::Pyth as u8;
    m.ai_oracle_authority = Pubkey::default();
    m.end_ts = end_ts;
    m.settled = false;

    m.fee_bps_snapshot = cfg.fee_bps;
    m.resolver_bps_snapshot = cfg.resolver_bps;
    m.creator_bps_snapshot = cfg.creator_bps;
    m.resolver_tip_cap_snapshot = 0;
    m.treasury_wallet_snapshot = cfg.treasury_wallet;

    m.feed_id = feed_id;
    m.market_type = match market_type {
        MarketType::PriceThreshold => 0,
        MarketType::PriceRange => 1,
    };
    m.comparator = comparator;
    m.bound_lo = bound_lo_usd_6;
    m.bound_hi = bound_hi_usd_6;
    m.resolved_price_1e6 = 0;

    // Multi-outcome defaults
    m.num_outcomes = 2;
    m.tvl_per_outcome = [0; MAX_OUTCOMES];
    m.outcome_idx = u8::MAX;
    m.payout_pool = 0;
    m.winners_mask = 0;
    m.tentative = false;

    // Legacy binary totals
    m.yes_total = 0;
    m.no_total = 0;
    m.winning_side = 0;

    Ok(())
}

pub fn create_market_multi(
    ctx: Context<CreateMarketMulti>,
    p: CreateMarketMultiParams,
) -> Result<()> {
    require!(
        p.num_outcomes >= 2 && (p.num_outcomes as usize) <= MAX_OUTCOMES,
        ErrorCode::BadMarketType
    );

    let m = &mut ctx.accounts.market;
    m.authority = ctx.accounts.authority.key();
    m.oracle_kind = p.oracle_kind;
    m.ai_oracle_authority = p.ai_oracle_authority;
    m.end_ts = p.end_ts;
    m.settled = false;

    // Fee snapshot
    let cfg = &ctx.accounts.config;
    m.fee_bps_snapshot = cfg.fee_bps;
    m.resolver_bps_snapshot = cfg.resolver_bps;
    m.creator_bps_snapshot = cfg.creator_bps;
    m.resolver_tip_cap_snapshot = 0;
    m.treasury_wallet_snapshot = cfg.treasury_wallet;

    // Pyth legacy clean
    m.feed_id = [0u8; 32];
    m.market_type = 0;
    m.comparator = 0;
    m.bound_lo = 0;
    m.bound_hi = 0;
    m.resolved_price_1e6 = 0;

    // Multi
    m.num_outcomes = p.num_outcomes;
    m.tvl_per_outcome = [0; MAX_OUTCOMES];
    m.outcome_idx = u8::MAX;
    m.payout_pool = 0;
    m.winners_mask = 0;
    m.tentative = false;

    // Legacy bin
    m.yes_total = 0;
    m.no_total = 0;
    m.winning_side = 0;

    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
#[instruction(
    market_type: MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
    feed_id: [u8; 32]
)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = Market::SPACE,
        seeds = [b"market", authority.key().as_ref(), &feed_id, &end_ts.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, Mint>,
    
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: PDA
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,
    
    /// CHECK: PDA
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_NO], bump)]
    pub escrow_authority_no: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority_yes
    )]
    pub escrow_vault_yes: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority_no
    )]
    pub escrow_vault_no: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMarketMultiParams {
    pub oracle_kind: u8,
    pub num_outcomes: u8,
    pub end_ts: i64,
    pub ai_oracle_authority: Pubkey,
    pub salt: [u8; 8],  // Unique salt to prevent PDA collisions
}

#[derive(Accounts)]
#[instruction(p: CreateMarketMultiParams)]
pub struct CreateMarketMulti<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = Market::SPACE,
        seeds = [b"market", authority.key().as_ref(), &p.end_ts.to_le_bytes(), &[p.oracle_kind], &p.salt],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}