use anchor_lang::prelude::*;

declare_id!("HhbBippsA7ETvNMNwBbY7Fg8B24DzgJ3nENetYPwR9bQ");

pub mod instructions;
pub mod constants;
pub mod errors;
pub mod events;
pub mod state;
pub mod types;
pub mod utils;

use instructions::*;

#[program]
pub mod prediction_market {
    use super::*;

    // ============ Admin ============
    pub fn init_config(
        ctx: Context<InitConfig>,
        fee_bps: u16,
        resolver_bps: u16,
        creator_bps: u16,
        resolver_tip_cap: u64,
    ) -> Result<()> {
        admin::init_config(ctx, fee_bps, resolver_bps, creator_bps, resolver_tip_cap)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        resolver_bps: Option<u16>,
        creator_bps: Option<u16>,
        resolver_tip_cap: Option<u64>,
        new_treasury: Option<Pubkey>,
    ) -> Result<()> {
        admin::update_config(ctx, fee_bps, resolver_bps, creator_bps, resolver_tip_cap, new_treasury)
    }

    // ============ Airdrop ============
    pub fn airdrop_once(ctx: Context<AirdropOnce>) -> Result<()> {
        airdrop::airdrop_once(ctx)
    }

    pub fn set_metadata(ctx: Context<SetMetadata>, uri: String) -> Result<()> {
        airdrop::set_metadata(ctx, uri)
    }

    // ============ Market Creation ============
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_type: types::MarketType,
        comparator: u8,
        bound_lo_usd_6: i64,
        bound_hi_usd_6: i64,
        end_ts: i64,
        feed_id: [u8; 32],
    ) -> Result<()> {
        market_create::create_market(ctx, market_type, comparator, bound_lo_usd_6, bound_hi_usd_6, end_ts, feed_id)
    }

    pub fn create_market_multi(ctx: Context<CreateMarketMulti>, p: CreateMarketMultiParams) -> Result<()> {
        market_create::create_market_multi(ctx, p)
    }

    // ============ Betting ============
    pub fn place_bet(ctx: Context<PlaceBet>, side: types::Side, amount: u64) -> Result<()> {
        betting::place_bet(ctx, side, amount)
    }

    pub fn place_bet_multi(ctx: Context<PlaceBetMulti>, outcome_idx: u8, amount: u64) -> Result<()> {
        betting::place_bet_multi(ctx, outcome_idx, amount)
    }

    // ============ Resolution ============
    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        resolve_pyth::resolve_market(ctx)
    }

    pub fn resolve_ai_propose<'info>(
        ctx: Context<'_, '_, 'info, 'info, ResolveAiPropose<'info>>,
    ) -> Result<()> {
        resolve_ai::propose(ctx)
    }

    pub fn finalize_ai<'info>(
        ctx: Context<'_, '_, 'info, 'info, FinalizeAi<'info>>,
    ) -> Result<()> {
        resolve_ai::finalize(ctx)
    }

    // ============ Claims ============
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claims::claim(ctx)
    }

    pub fn claim_multi(ctx: Context<ClaimMulti>, outcome_idx: u8) -> Result<()> {
        claims::claim_multi(ctx, outcome_idx)
    }
}