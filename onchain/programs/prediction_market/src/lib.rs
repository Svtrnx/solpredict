use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::{
    instructions::CreateMetadataAccountV3CpiBuilder, types::DataV2, ID as TOKEN_METADATA_PROGRAM_ID,
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

declare_id!("HhbBippsA7ETvNMNwBbY7Fg8B24DzgJ3nENetYPwR9bQ"); // Program ID

use anchor_lang::prelude::pubkey;
pub const USDC_MINT: Pubkey = pubkey!("5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh"); // USDC mint address (devnet)

// === Constants ===
const BPS_DENOM: u64 = 10_000;
const ESCROW_SEED: &[u8] = b"escrow-auth";
const SIDE_YES: &[u8] = b"yes";
const SIDE_NO: &[u8] = b"no";

// ====== Program ======
#[program]
pub mod prediction_market {
    use super::*;

    pub fn airdrop_once(ctx: Context<AirdropOnce>) -> Result<()> {
        require_keys_eq!(ctx.accounts.mint.key(), USDC_MINT, AirdropError::WrongMint);
        require!(!ctx.accounts.claim.claimed, AirdropError::AlreadyClaimed);

        // PDA signer for ["mint-auth"]
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
        // Address sanity checks
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
        require_keys_eq!(
            ctx.accounts.metadata.key(),
            expected_md,
            AirdropError::WrongMint
        );

        // Metadata payload
        let data = DataV2 {
            name: "USDC Predict".to_string(),
            symbol: "$".to_string(),
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        // PDA signer
        let bump = ctx.bumps.mint_authority;
        let signer_seeds: &[&[u8]] = &[b"mint-auth", &[bump]];

        // 4) Cast accounts to AccountInfo
        let tm_prog_ai = ctx.accounts.token_metadata_program.to_account_info();
        let metadata_ai = ctx.accounts.metadata.to_account_info();
        let mint_ai = ctx.accounts.mint.to_account_info();
        let mint_auth_ai = ctx.accounts.mint_authority.to_account_info();
        let payer_ai = ctx.accounts.payer.to_account_info();
        let sys_ai = ctx.accounts.system_program.to_account_info();
        let rent_ai = ctx.accounts.rent.to_account_info();

        // CPI builder
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

    // ---------- Protocol configuration ----------
    pub fn init_config(
        ctx: Context<InitConfig>,
        fee_bps: u16,          // e.g. 100 = 1.00%
        resolver_bps: u16,     // e.g. 5 = 0.05%
        resolver_tip_cap: u64, // absolute cap in base units (1e6 = 1 USDC)
    ) -> Result<()> {
        require!((fee_bps as u64) <= BPS_DENOM, ErrorCode::BadBps);
        require!((resolver_bps as u64) <= BPS_DENOM, ErrorCode::BadBps);
        require!(
            (fee_bps as u64) + (resolver_bps as u64) <= BPS_DENOM,
            ErrorCode::BadBps
        );

        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.treasury_wallet = ctx.accounts.treasury_wallet.key();
        cfg.fee_bps = fee_bps;
        cfg.resolver_bps = resolver_bps;
        cfg.resolver_tip_cap = resolver_tip_cap;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        resolver_bps: Option<u16>,
        resolver_tip_cap: Option<u64>,
        new_treasury: Option<Pubkey>,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.admin,
            ctx.accounts.admin.key(),
            ErrorCode::Unauthorized
        );

        // Merge incoming values with current ones; keep invariants
        let cur_fee = ctx.accounts.config.fee_bps as u64;
        let cur_res = ctx.accounts.config.resolver_bps as u64;

        let next_fee = fee_bps.map(|v| v as u64).unwrap_or(cur_fee);
        let next_res = resolver_bps.map(|v| v as u64).unwrap_or(cur_res);

        require!(next_fee <= BPS_DENOM, ErrorCode::BadBps);
        require!(next_res <= BPS_DENOM, ErrorCode::BadBps);
        require!(next_fee + next_res <= BPS_DENOM, ErrorCode::BadBps);

        if let Some(v) = fee_bps {
            ctx.accounts.config.fee_bps = v;
        }
        if let Some(v) = resolver_bps {
            ctx.accounts.config.resolver_bps = v;
        }
        if let Some(v) = resolver_tip_cap {
            ctx.accounts.config.resolver_tip_cap = v;
        }
        if let Some(v) = new_treasury {
            ctx.accounts.config.treasury_wallet = v;
        }
        Ok(())
    }

    // ---------- Market ----------
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_type: MarketType,
        comparator: u8,      // for threshold
        bound_lo_usd_6: i64, // threshold or lower bound
        bound_hi_usd_6: i64, // 0 for threshold or upper bound
        end_ts: i64,
        feed_id: [u8; 32],
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.mint.key(), USDC_MINT, ErrorCode::WrongMint);

        // Snapshot current config into the market account
        let cfg = &ctx.accounts.config;
        let m = &mut ctx.accounts.market;
        m.authority = ctx.accounts.authority.key();
        m.feed_id = feed_id;
        m.market_type = match market_type {
            MarketType::PriceThreshold => 0,
            MarketType::PriceRange => 1,
        };
        m.comparator = comparator;
        m.bound_lo = bound_lo_usd_6;
        m.bound_hi = bound_hi_usd_6;
        m.end_ts = end_ts;
        m.settled = false;
        m.winning_side = 0;
        m.resolved_price_1e6 = 0;
        m.yes_total = 0;
        m.no_total = 0;
        m.payout_pool = 0;

        m.fee_bps_snapshot = cfg.fee_bps;
        m.resolver_bps_snapshot = cfg.resolver_bps;
        m.resolver_tip_cap_snapshot = 0;
        m.treasury_wallet_snapshot = cfg.treasury_wallet;

        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, side: Side, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let now = Clock::get()?.unix_timestamp;
        require!(now < ctx.accounts.market.end_ts, ErrorCode::TooLateToBet);
        require!(!ctx.accounts.market.settled, ErrorCode::AlreadySettled);

        // User ATA is created on demand; pick the target escrow vault (YES/NO)
        let (vault_ai, _, is_yes) = match side {
            Side::Yes => (
                &ctx.accounts.escrow_vault_yes,
                ctx.bumps.escrow_authority_yes,
                true,
            ),
            Side::No => (
                &ctx.accounts.escrow_vault_no,
                ctx.bumps.escrow_authority_no,
                false,
            ),
        };

        // Transfer from user to the selected vault (user signs; no PDA signer required)
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

        // Update per-user position and aggregate market totals
        let pos = &mut ctx.accounts.position;
        // On first initialization, set owner/market links
        if pos.user == Pubkey::default() {
            pos.user = ctx.accounts.user.key();
            pos.market = ctx.accounts.market.key();
        }
        // Safety: ensure position matches caller and market
        require_keys_eq!(pos.user, ctx.accounts.user.key(), ErrorCode::Unauthorized);
        require_keys_eq!(
            pos.market,
            ctx.accounts.market.key(),
            ErrorCode::Unauthorized
        );

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

    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        let m = &mut ctx.accounts.market;

        // Time invariants
        require!(!m.settled, ErrorCode::AlreadySettled);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= m.end_ts, ErrorCode::TooEarly);

        // Solvency check based on actual vault balances
        ctx.accounts.escrow_vault_yes.reload()?;
        ctx.accounts.escrow_vault_no.reload()?;
        let yes_amt_u64 = ctx.accounts.escrow_vault_yes.amount;
        let no_amt_u64  = ctx.accounts.escrow_vault_no.amount;

        if yes_amt_u64 == 0 || no_amt_u64 == 0 {
            // One-sided market: VOID without fees/transfers. Claim() refunds 1:1.
            m.winning_side = 3; // VOID
            m.payout_pool = 0;
            m.settled = true;

            emit!(MarketResolved {
                market: m.key(),
                winning_side: m.winning_side,
                resolved_price_1e6: m.resolved_price_1e6,
                pot: 0,
                fee: 0,
                tip: 0,
                payout_pool: 0,
            });
            return Ok(());
        }

        // Resolve horizon: too late => VOID
        const RESOLVE_HORIZON_SECS: i64 = 15 * 86_400; // 15 days
        if now - m.end_ts > RESOLVE_HORIZON_SECS {
            m.winning_side = 3; // VOID
            m.payout_pool = 0;
            m.settled = true;
            msg!(
                "[RESOLVE] VOID: resolve horizon exceeded ({}s > {}s)",
                now - m.end_ts,
                RESOLVE_HORIZON_SECS
            );
            emit!(MarketResolved {
                market: m.key(),
                winning_side: m.winning_side,
                resolved_price_1e6: m.resolved_price_1e6,
                pot: 0,
                fee: 0,
                tip: 0,
                payout_pool: 0,
            });
            return Ok(());
        }

        // Pyth: read price with a small grace window after end_ts
        let max_age_i64 = (now - m.end_ts) + 600; // allow a small“catch up period
        let max_age: u64 = max_age_i64.try_into().unwrap_or(u64::MAX);

        let price = ctx
            .accounts
            .price_update
            .get_price_no_older_than(&Clock::get()?, max_age, &m.feed_id)
            .map_err(|_| error!(ErrorCode::InvalidPriceFeed))?;

        // end_ts: not earlier than end_ts and not older than 24h after it
        let max_post_lag: i64 = 86_400; // 24h
        let pt = price.publish_time; // i64
        require!(pt >= m.end_ts, ErrorCode::StalePrice);
        require!(pt - m.end_ts <= max_post_lag, ErrorCode::StalePrice);

        // Convert Pyth -> 1e6
        let price_1e6 = price_to_usd_1e6_from_pyth(price.price, price.exponent)?;
        m.resolved_price_1e6 = price_1e6;

        msg!(
            "[RESOLVE] feed={:?} publish_time={} raw_price={} expo={} -> resolved_price_1e6={}",
            &m.feed_id,
            price.publish_time,
            price.price,
            price.exponent,
            price_1e6
        );

        // Outcome logic: YES if condition holds
        let yes_is_true = match m.market_type {
            0 => cmp_check(m.comparator, price_1e6, m.bound_lo)?,               // Threshold
            1 => (price_1e6 >= m.bound_lo) && (price_1e6 <= m.bound_hi),        // Range
            _ => return Err(error!(ErrorCode::BadMarketType)),
        };
        let winner_is_yes = yes_is_true;
        m.winning_side = if winner_is_yes { 1 } else { 2 };

        // Defensive: the winning side must have winners by snapshot
        let total_winners = if winner_is_yes { m.yes_total } else { m.no_total };
        if total_winners == 0 {
            // Anomaly guard: treat as VOID
            m.winning_side = 3; // VOID
            m.payout_pool = 0;
            m.settled = true;
            msg!("[RESOLVE] VOID: no winners on the winning side (total_winners=0)");
            emit!(MarketResolved {
                market: m.key(),
                winning_side: m.winning_side,
                resolved_price_1e6: m.resolved_price_1e6,
                pot: 0,
                fee: 0,
                tip: 0,
                payout_pool: 0,
            });
            return Ok(());
        }

        // Pool & fees math
        let yes_amt = yes_amt_u64 as u128;
        let no_amt  = no_amt_u64  as u128;

        let pot_u128 = yes_amt
            .checked_add(no_amt)
            .ok_or(error!(ErrorCode::Overflow))?;

        let fee_u128 = mul_div_bps_u128(pot_u128, m.fee_bps_snapshot as u128)?;
        let tip_u128 = mul_div_bps_u128(pot_u128, m.resolver_bps_snapshot as u128)?;


        let payout_pool_u128 = pot_u128
            .checked_sub(fee_u128).ok_or(error!(ErrorCode::Overflow))?
            .checked_sub(tip_u128).ok_or(error!(ErrorCode::Overflow))?;

        // Merge losing vault into the winning vault to consolidate funds
        let market_key = m.key();
        let bump_yes = ctx.bumps.escrow_authority_yes;
        let bump_no  = ctx.bumps.escrow_authority_no;


        let bump_yes_arr = [bump_yes];
        let bump_no_arr  = [bump_no]; 

        // Helper builds PDA seeds: [ESCROW_SEED, market, SIDE_*, bump]
        let seeds_yes: [&[u8]; 4] = escrow_signer_seeds(&market_key, SIDE_YES, &bump_yes_arr);
        let seeds_no:  [&[u8]; 4] = escrow_signer_seeds(&market_key, SIDE_NO,  &bump_no_arr);

        if winner_is_yes && no_amt_u64 > 0 {
            let signers: &[&[&[u8]]] = &[&seeds_no];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault_no.to_account_info(),
                        to:   ctx.accounts.escrow_vault_yes.to_account_info(),
                        authority: ctx.accounts.escrow_authority_no.to_account_info(),
                    },
                    signers,
                ),
                no_amt_u64,
            )?;
        } else if !winner_is_yes && yes_amt_u64 > 0 {
            let signers: &[&[&[u8]]] = &[&seeds_yes];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault_yes.to_account_info(),
                        to:   ctx.accounts.escrow_vault_no.to_account_info(),
                        authority: ctx.accounts.escrow_authority_yes.to_account_info(),
                    },
                    signers,
                ),
                yes_amt_u64,
            )?;
        }

        // Choose winning vault/authority and prepare tip/fee transfers
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

        // Additional cheap invariants: protect against ATA spoofing
        require_keys_eq!(ctx.accounts.resolver_ata.mint,  ctx.accounts.mint.key());
        require_keys_eq!(ctx.accounts.treasury_ata.mint,  ctx.accounts.mint.key());


        let win_bump_arr = [win_bump];
        // Pay tip/fee from the winner vault (signed by the winner PDA)
        let win_seeds: [&[u8]; 4] = escrow_signer_seeds(&market_key, win_side, &win_bump_arr);
        let win_signers: &[&[&[u8]]] = &[&win_seeds];

        if tip_u64 > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: win_vault.to_account_info(),
                        to:   ctx.accounts.resolver_ata.to_account_info(),
                        authority: win_auth.to_account_info(),
                    },
                    win_signers,
                ),
                tip_u64,
            )?;
        }

        if fee_u64 > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: win_vault.to_account_info(),
                        to:   ctx.accounts.treasury_ata.to_account_info(),
                        authority: win_auth.to_account_info(),
                    },
                    win_signers,
                ),
                fee_u64,
            )?;
        }

        // Snapshot the final winner vault balance; clamp payout_pool to actual funds
        if winner_is_yes {
            ctx.accounts.escrow_vault_yes.reload()?;
            let remain_u64 = ctx.accounts.escrow_vault_yes.amount;
            let pp_u64: u64 = payout_pool_u128.try_into().unwrap_or(u64::MAX);
            m.payout_pool = core::cmp::min(pp_u64, remain_u64);
        } else {
            ctx.accounts.escrow_vault_no.reload()?;
            let remain_u64 = ctx.accounts.escrow_vault_no.amount;
            let pp_u64: u64 = payout_pool_u128.try_into().unwrap_or(u64::MAX);
            m.payout_pool = core::cmp::min(pp_u64, remain_u64);
        }

        m.settled = true;

        emit!(MarketResolved {
            market: m.key(),
            winning_side: m.winning_side,
            resolved_price_1e6: m.resolved_price_1e6,
            pot: pot_u128,
            fee: fee_u128,
            tip: tip_u128,
            payout_pool: m.payout_pool as u128,
        });

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let m = &ctx.accounts.market;
        require!(m.settled, ErrorCode::MarketNotResolved);

        let pos = &mut ctx.accounts.position;
        require!(!pos.claimed, ErrorCode::AlreadyClaimed);

        let market_key = m.key();

        // === VOID case: return user deposits (no fees) ===
        if m.winning_side == 3 {
            // Refund YES, if any
            if pos.yes_bet > 0 {
                let bump_yes = ctx.bumps.escrow_authority_yes;
                let bump_yes_arr = [bump_yes]; // pass bump as a slice
                let seeds_yes: [&[u8]; 4] =
                    escrow_signer_seeds(&market_key, SIDE_YES, &bump_yes_arr);
                let signers_yes: &[&[&[u8]]] = &[&seeds_yes];

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
                            signers_yes,
                        ),
                        amt_yes,
                    )?;
                }
            }

            // Refund NO, if any
            if pos.no_bet > 0 {
                let bump_no = ctx.bumps.escrow_authority_no;
                let bump_no_arr = [bump_no]; // pass bump as a slice
                let seeds_no: [&[u8]; 4] = escrow_signer_seeds(&market_key, SIDE_NO, &bump_no_arr);
                let signers_no: &[&[&[u8]]] = &[&seeds_no];

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
                            signers_no,
                        ),
                        amt_no,
                    )?;
                }
            }

            pos.claimed = true;
            return Ok(());
        }

        // === Normal case: 1=YES or 2=NO won ===
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
                _ => return Err(error!(ErrorCode::MarketNotResolved)), // guard against invalid values
            };

        require!(user_side_amt > 0, ErrorCode::NoWinningBet);

        let bump_arr = [win_bump];
        let seeds: [&[u8]; 4] = escrow_signer_seeds(&market_key, win_side, &bump_arr);
        let signers: &[&[&[u8]]] = &[&seeds];

        // Pro-rata distribution from fixed payout_pool
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
                    signers,
                ),
                payout,
            )?;
        }

        pos.claimed = true;
        Ok(())
    }
}

// ===== Types & Accounts =====

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketType {
    PriceThreshold,
    PriceRange,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury_wallet: Pubkey,
    pub fee_bps: u16,
    pub resolver_bps: u16,
    pub resolver_tip_cap: u64, // token base units (1e6 = 1 USDC)
}
impl Config {
    pub const SPACE: usize = 8 + 32 + 32 + 2 + 2 + 8;
}

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub feed_id: [u8; 32],
    // pub feed: Pubkey,
    pub market_type: u8, // 0=Threshold, 1=Range
    pub comparator: u8,  // 0=>,1=<,2=>=,3=<= (for Threshold)
    pub bound_lo: i64,   // USD*1e6 (threshold or lower bound)
    pub bound_hi: i64,   // USD*1e6 (upper bound for Range)
    pub end_ts: i64,
    pub settled: bool,

    pub yes_total: u64, // accumulated YES liquidity
    pub no_total: u64,  // accumulated NO liquidity

    pub fee_bps_snapshot: u16,
    pub resolver_bps_snapshot: u16,
    pub resolver_tip_cap_snapshot: u64,
    pub treasury_wallet_snapshot: Pubkey,

    pub winning_side: u8, // 0=undef, 1=YES, 2=NO, 3=VOID (canceled — refunds)
    pub resolved_price_1e6: i64,
    pub payout_pool: u64, // amount to distribute to winners (fixed at resolve)
}
impl Market {
    pub const SPACE: usize = 176;
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_bet: u64,
    pub no_bet: u64,
    pub claimed: bool,
}
impl Position {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

// ---- Helpers ----
fn price_to_usd_1e6_from_pyth(price: i64, exponent: i32) -> Result<i64> {
    let mut v = price as i128;
    let shift = exponent as i128 + 6; // price * 10^(exponent) * 1e6
    if shift >= 0 {
        v *= 10i128.pow(shift as u32);
    } else {
        v /= 10i128.pow((-shift) as u32);
    }
    if v > i64::MAX as i128 || v < i64::MIN as i128 {
        return Err(error!(ErrorCode::Overflow));
    }
    Ok(v as i64)
}

fn cmp_check(comparator: u8, lhs: i64, rhs: i64) -> Result<bool> {
    Ok(match comparator {
        0 => lhs > rhs,
        1 => lhs < rhs,
        2 => lhs >= rhs,
        3 => lhs <= rhs,
        _ => return Err(error!(ErrorCode::BadComparator)),
    })
}

fn mul_div_u64(a: u64, b: u64, d: u64) -> Result<u64> {
    let num = (a as u128)
        .checked_mul(b as u128)
        .ok_or(ErrorCode::Overflow)?;
    Ok((num / d as u128) as u64)
}

#[inline]
fn mul_div_bps_u128(x: u128, bps: u128) -> Result<u128> {
    // (x * bps) / 10_000 with overflow checks
    let num = x.checked_mul(bps).ok_or(error!(ErrorCode::Overflow))?;
    Ok(num / 10_000)
}

#[inline]
fn escrow_signer_seeds<'a>(
    market: &'a Pubkey,
    side: &'a [u8],
    bump: &'a [u8], // bump is passed from the caller as a single-byte slice
) -> [&'a [u8]; 4] {
    [ESCROW_SEED, market.as_ref(), side, bump]
}

// ===== Accounts =====

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: treasury wallet
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
    pub authority: Signer<'info>, // user pays rent

    // /// CHECK: Pyth price account
    // pub price_feed: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = Market::SPACE,
        seeds = [b"market", authority.key().as_ref(), &feed_id, &end_ts.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, Mint>,

    /// CHECK: Two PDAs as vault owners (YES/NO)
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,

    /// CHECK: Two PDAs as vault owners (YES/NO)
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_NO], bump)]
    pub escrow_authority_no: UncheckedAccount<'info>,

    // Two ATAs (one per side)
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

    // Config is snapshotted into the market
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, constraint = !market.settled @ ErrorCode::AlreadySettled)]
    pub market: Account<'info, Market>,

    // /// CHECK: Oracle feed account, validated in logic
    // pub feed: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA derived inside the program, only used as authority
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,

    /// CHECK: PDA derived inside the program, only used as authority
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_NO], bump)]
    pub escrow_authority_no: UncheckedAccount<'info>,

    #[account(mut, constraint = escrow_vault_yes.mint == mint.key())]
    pub escrow_vault_yes: Account<'info, TokenAccount>,
    #[account(mut, constraint = escrow_vault_no.mint == mint.key())]
    pub escrow_vault_no: Account<'info, TokenAccount>,

    // User's per-market position PDA
    #[account(
        init_if_needed,
        payer = user,
        space = Position::SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    // /// CHECK: Oracle feed account
    // pub feed: UncheckedAccount<'info>,
    pub price_update: Account<'info, PriceUpdateV2>,

    // Resolver receives the tip
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

    // Treasury ATA (must match snapshot)
    #[account(
        mut,
        constraint = treasury_ata.mint == mint.key(),
        constraint = treasury_ata.owner == market.treasury_wallet_snapshot
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA derived inside the program, only used as authority
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,

    /// CHECK: PDA derived inside the program, only used as authority
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
    pub position: Account<'info, Position>,

    /// CHECK: PDA derived inside the program, only used as authority
    #[account(seeds = [ESCROW_SEED, market.key().as_ref(), SIDE_YES], bump)]
    pub escrow_authority_yes: UncheckedAccount<'info>,

    /// CHECK: PDA derived inside the program, only used as authority
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

// ===== Demo structs/events/errors =====

#[account]
pub struct AirdropClaim {
    pub claimed: bool,
    pub when: i64,
}
impl AirdropClaim {
    pub const SIZE: usize = 1 + 8;
}

pub const AIRDROP_AMOUNT: u64 = 1_000 * 1_000_000;

#[derive(Accounts)]
pub struct AirdropOnce<'info> {
    /// CHECK: Airdrop recipient
    pub user: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(seeds = [b"mint-auth"], bump)]
    /// CHECK: Mint addr
    pub mint_authority: UncheckedAccount<'info>,
    #[account(init_if_needed, payer = payer, associated_token::mint = mint, associated_token::authority = user)]
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

    #[account(seeds = [b"mint-auth"], bump)]
    /// CHECK: Mint addr
    pub mint_authority: UncheckedAccount<'info>,

    #[account(mut)]

    /// CHECK: metadata account
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex token metadata program
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winning_side: u8, // 1 YES, 2 NO, 3 VOID
    pub resolved_price_1e6: i64,
    pub pot: u128,
    pub fee: u128,
    pub tip: u128,
    pub payout_pool: u128,
}

#[event]
pub struct Airdropped {
    pub user: Pubkey,
    pub ata: Pubkey,
    pub amount: u64,
}
#[event]
pub struct Initialized {
    pub authority: Pubkey,
    pub counter: Pubkey,
}
#[event]
pub struct Incremented {
    pub authority: Pubkey,
    pub counter: Pubkey,
    pub amount: u64,
    pub new_value: u64,
}

#[error_code]
pub enum AirdropError {
    #[msg("Airdrop already claimed for this wallet")]
    AlreadyClaimed,
    #[msg("Wrong mint")]
    WrongMint,
}
#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be > 0")]
    InvalidAmount,
    #[msg("Overflow")]
    Overflow,
    #[msg("Only authority can do this")]
    Unauthorized,
    #[msg("Wrong mint")]
    WrongMint,
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Too early to resolve")]
    TooEarly,
    #[msg("Too late to bet")]
    TooLateToBet,
    #[msg("Invalid price feed")]
    InvalidPriceFeed,
    #[msg("Bad comparator")]
    BadComparator,
    #[msg("Bad market type")]
    BadMarketType,
    #[msg("Market not resolved")]
    MarketNotResolved,
    #[msg("No winning bet to claim")]
    NoWinningBet,
    #[msg("Payout already claimed")]
    AlreadyClaimed,
    #[msg("Bad basis points value")]
    BadBps,
    #[msg("Stale Pyth price")]
    StalePrice,
}
