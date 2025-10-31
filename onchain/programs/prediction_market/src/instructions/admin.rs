use anchor_lang::prelude::*;
use crate::{constants::BPS_DENOM, errors::ErrorCode, state::Config};

pub fn init_config(
    ctx: Context<InitConfig>,
    fee_bps: u16,
    resolver_bps: u16,
    creator_bps: u16,
    resolver_tip_cap: u64,
) -> Result<()> {
    require!((fee_bps as u64) <= BPS_DENOM, ErrorCode::BadBps);
    require!((resolver_bps as u64) <= BPS_DENOM, ErrorCode::BadBps);
    require!((creator_bps as u64) <= BPS_DENOM, ErrorCode::BadBps);
    require!(
        (fee_bps as u64) + (resolver_bps as u64) + (creator_bps as u64) <= BPS_DENOM,
        ErrorCode::BadBps
    );

    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.treasury_wallet = ctx.accounts.treasury_wallet.key();
    cfg.fee_bps = fee_bps;
    cfg.resolver_bps = resolver_bps;
    cfg.creator_bps = creator_bps;
    cfg.resolver_tip_cap = resolver_tip_cap;
    
    Ok(())
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    resolver_bps: Option<u16>,
    creator_bps: Option<u16>,
    resolver_tip_cap: Option<u64>,
    new_treasury: Option<Pubkey>,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.config.admin,
        ctx.accounts.admin.key(),
        ErrorCode::Unauthorized
    );

    let cfg = &ctx.accounts.config;
    let cur_fee = cfg.fee_bps as u64;
    let cur_res = cfg.resolver_bps as u64;
    let cur_creator = cfg.creator_bps as u64;

    let next_fee = fee_bps.map(|v| v as u64).unwrap_or(cur_fee);
    let next_res = resolver_bps.map(|v| v as u64).unwrap_or(cur_res);
    let next_creator = creator_bps.map(|v| v as u64).unwrap_or(cur_creator);

    require!(next_fee <= BPS_DENOM, ErrorCode::BadBps);
    require!(next_res <= BPS_DENOM, ErrorCode::BadBps);
    require!(next_creator <= BPS_DENOM, ErrorCode::BadBps);
    require!(next_fee + next_res + next_creator <= BPS_DENOM, ErrorCode::BadBps);

    let cfg = &mut ctx.accounts.config;
    if let Some(v) = fee_bps {
        cfg.fee_bps = v;
    }
    if let Some(v) = resolver_bps {
        cfg.resolver_bps = v;
    }
    if let Some(v) = creator_bps {
        cfg.creator_bps = v;
    }
    if let Some(v) = resolver_tip_cap {
        cfg.resolver_tip_cap = v;
    }
    if let Some(v) = new_treasury {
        cfg.treasury_wallet = v;
    }
    
    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: Treasury wallet address
    pub treasury_wallet: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = admin,
        space = Config::SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
}

pub fn close_config(ctx: Context<CloseConfig>) -> Result<()> {
    let config_lamports = ctx.accounts.config.lamports();
    **ctx.accounts.config.try_borrow_mut_lamports()? -= config_lamports;
    **ctx.accounts.admin.try_borrow_mut_lamports()? += config_lamports;

    Ok(())
}

#[derive(Accounts)]
pub struct CloseConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Config account validated by seeds constraint
    #[account(
        mut,
        seeds = [b"config"],
        bump
    )]
    pub config: UncheckedAccount<'info>,
}