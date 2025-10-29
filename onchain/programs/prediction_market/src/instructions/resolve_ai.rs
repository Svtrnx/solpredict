use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program,
	program_pack::Pack,
    sysvar::instructions as sysvar_instructions,
    sysvar::instructions::ID as SYSVAR_INSTRUCTIONS_ID,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use spl_token::state::Account as SplTokenAccount;

use crate::{
    constants::{
        ATTESTATION_FUTURE_TOLERANCE, ATTESTATION_TIME_TOLERANCE, OUTCOME_NONE,
    },
    errors::ErrorCode,
    events::{MarketProposedAi, MarketResolvedAi},
    state::Market,
    types::OracleKind,
    utils::{
        attestation::{parse_attestation_message, parse_ed25519, ParsedMode},
        fees::FeeBreakdown,
        pda::{outcome_signer_seeds, pda_escrow_auth_outcome},
        transfers::{
            categorize_accounts, distribute_fees_from_winners, distribute_loser_funds_to_winners,
            transfer_losers_to_winner,
        },
    },
};

pub fn propose<'info>(
    ctx: Context<'_, '_, 'info, 'info, ResolveAiPropose<'info>>,
) -> Result<()> {
    require!(
        ctx.accounts.market.oracle_kind == OracleKind::Ai as u8,
        ErrorCode::BadMarketType
    );
    require!(!ctx.accounts.market.settled, ErrorCode::AlreadySettled);
    
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.market.end_ts, ErrorCode::TooEarly);

    // Parse ed25519 instruction
    let cur_ix = sysvar_instructions::load_current_index_checked(&ctx.accounts.ix_sysvar)?;
    require!(cur_ix > 0, ErrorCode::Unauthorized);
    
    let ed_ix = sysvar_instructions::load_instruction_at_checked(
        (cur_ix - 1) as usize,
        &ctx.accounts.ix_sysvar,
    )?;
    
    require_keys_eq!(ed_ix.program_id, ed25519_program::id(), ErrorCode::Unauthorized);
    
    let (pk_bytes, msg_bytes) = parse_ed25519(&ed_ix.data)
        .map_err(|_| error!(ErrorCode::Unauthorized))?;
    
    require!(
        pk_bytes == &ctx.accounts.market.ai_oracle_authority.to_bytes(),
        ErrorCode::Unauthorized
    );

let program_id = ctx.program_id;
    let market_key = ctx.accounts.market.key();
    let num_outcomes = ctx.accounts.market.num_outcomes;
    let tvl = ctx.accounts.market.tvl_per_outcome;

    enum Mode {
        Single { win: u8 },
        Multi { mask: u8 },
    }

    let parsed = parse_attestation_message(msg_bytes)?;
    let (expected, mode) = match parsed {
        ParsedMode::Single {
            outcome_idx,
            end_ts,
            attest_ts,
            nonce,
            program,
            market,
        } => {
            require_keys_eq!(market, market_key, ErrorCode::Unauthorized);
            require!(outcome_idx < num_outcomes, ErrorCode::BadMarketType);
            require!(end_ts == ctx.accounts.market.end_ts, ErrorCode::Unauthorized);
            require!(
                attest_ts <= now + ATTESTATION_FUTURE_TOLERANCE,
                ErrorCode::Unauthorized
            );
            require!(
                now - attest_ts <= ATTESTATION_TIME_TOLERANCE,
                ErrorCode::Unauthorized
            );
            require_keys_eq!(program, *program_id, ErrorCode::Unauthorized);

            let att = crate::utils::attestation::AttestationSingle {
                market,
                outcome_idx,
                end_ts,
                attest_ts,
                nonce,
                program: *program_id,
            };
            (
                crate::utils::attestation::build_message_single(&att),
                Mode::Single { win: outcome_idx },
            )
        }
        ParsedMode::Multi {
            winners,
            end_ts,
            attest_ts,
            nonce,
            program,
            market,
        } => {
            require_keys_eq!(market, market_key, ErrorCode::Unauthorized);
            require!(end_ts == ctx.accounts.market.end_ts, ErrorCode::Unauthorized);
            require!(
                attest_ts <= now + ATTESTATION_FUTURE_TOLERANCE,
                ErrorCode::Unauthorized
            );
            require!(
                now - attest_ts <= ATTESTATION_TIME_TOLERANCE,
                ErrorCode::Unauthorized
            );
            require_keys_eq!(program, *program_id, ErrorCode::Unauthorized);

            require!(!winners.is_empty(), ErrorCode::BadMarketType);

            // Calculate mask and validate indices
            let mut mask: u8 = 0;
            let mut winners_total: u128 = 0;
            for &w in winners.iter() {
                require!(w < num_outcomes, ErrorCode::BadMarketType);
                if (mask & (1 << w)) == 0 {
                    mask |= 1 << w;
                    winners_total = winners_total
                        .checked_add(tvl[w as usize] as u128)
                        .ok_or(error!(ErrorCode::Overflow))?;
                }
            }
            require!(winners_total > 0, ErrorCode::NoWinningBet);

            let att = crate::utils::attestation::AttestationMultiWinners {
                market,
                winners: winners.clone(),
                end_ts,
                attest_ts,
                nonce,
                program: *program_id,
            };
            (
                crate::utils::attestation::build_message_multi(&att),
                Mode::Multi { mask },
            )
        }
    };

    require!(msg_bytes == expected.as_slice(), ErrorCode::Unauthorized);

    // Update market state
    let pot_u128: u128 = tvl.iter().map(|&x| x as u128).sum();
    let m = &mut ctx.accounts.market;
    match mode {
        Mode::Single { win } => {
            m.outcome_idx = win;
            m.winners_mask = 0;
        }
        Mode::Multi { mask } => {
            m.outcome_idx = u8::MAX;
            m.winners_mask = mask;
        }
    }
    m.tentative = true;

    emit!(MarketProposedAi {
        market: market_key,
        outcome_idx: m.outcome_idx,
        winners_mask: m.winners_mask,
        pot: pot_u128,
    });

    Ok(())
}

pub fn finalize<'info>(
    ctx: Context<'_, '_, 'info, 'info, FinalizeAi<'info>>,
) -> Result<()> {
    let m = &mut ctx.accounts.market;

    // Validation
    require!(m.oracle_kind == OracleKind::Ai as u8, ErrorCode::BadMarketType);
    require!(m.tentative, ErrorCode::Unauthorized);
    require!(!m.settled, ErrorCode::AlreadySettled);

    let market_key = m.key();
    let program_id = ctx.program_id;
    let mint_key = ctx.accounts.mint.key();
    let num_outcomes = m.num_outcomes;
    let tvl = m.tvl_per_outcome;

    // Calculate fees
    let pot_u128: u128 = tvl.iter().map(|&x| x as u128).sum();
    let fees = FeeBreakdown::calculate(
        pot_u128,
        m.fee_bps_snapshot,
        m.resolver_bps_snapshot,
        m.creator_bps_snapshot,
    )?;

    // Determine resolution mode
    let is_single_winner = m.winners_mask == 0 && m.outcome_idx != u8::MAX;

    if is_single_winner {
        finalize_single_winner(ctx, &fees, market_key, program_id, mint_key, num_outcomes, pot_u128)?;
    } else {
        finalize_multi_winner(ctx, &fees, market_key, program_id, mint_key, num_outcomes, tvl, pot_u128)?;
    }

    Ok(())
}

// ============ Single Winner Logic ============

fn finalize_single_winner<'info>(
    ctx: Context<'_, '_, 'info, 'info, FinalizeAi<'info>>,
    fees: &FeeBreakdown,
    market_key: Pubkey,
    program_id: &Pubkey,
    mint_key: Pubkey,
    num_outcomes: u8,
    pot_u128: u128,
) -> Result<()> {
    let m = &mut ctx.accounts.market;
    let win = m.outcome_idx;

    // Verify winner authority PDA
    let (win_pda, win_bump) = pda_escrow_auth_outcome(&market_key, win, program_id);
    require_keys_eq!(win_pda, ctx.accounts.win_authority.key(), ErrorCode::Unauthorized);
    require_keys_eq!(ctx.accounts.win_vault.owner, win_pda, ErrorCode::Unauthorized);
    require_keys_eq!(ctx.accounts.win_vault.mint, mint_key, ErrorCode::WrongMint);
    require_keys_eq!(ctx.accounts.treasury_ata.mint, mint_key, ErrorCode::WrongMint);

    // Transfer all losing stakes to winner vault
    transfer_losers_to_winner(
        ctx.remaining_accounts,
        &ctx.accounts.token_program,
        &ctx.accounts.win_vault,
        market_key,
        program_id,
        mint_key,
        num_outcomes,
        win,
    )?;

    // Distribute fees and tips
    let (fee_u64, resolver_u64, creator_u64) = fees.to_u64_parts()?;

    let win_idx = [win];
    let win_barr = [win_bump];
    let win_signer = outcome_signer_seeds(&market_key, &win_idx, &win_barr);

    // Pay resolver tip
    if resolver_u64 > 0 {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.win_vault.to_account_info(),
                    to: ctx.accounts.resolver_ata.to_account_info(),
                    authority: ctx.accounts.win_authority.to_account_info(),
                },
                &[&win_signer],
            ),
            resolver_u64,
        )?;
    }

    // Pay creator tip
    if creator_u64 > 0 {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.win_vault.to_account_info(),
                    to: ctx.accounts.creator_ata.to_account_info(),
                    authority: ctx.accounts.win_authority.to_account_info(),
                },
                &[&win_signer],
            ),
            creator_u64,
        )?;
    }

    // Pay protocol fee
    if fee_u64 > 0 {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.win_vault.to_account_info(),
                    to: ctx.accounts.treasury_ata.to_account_info(),
                    authority: ctx.accounts.win_authority.to_account_info(),
                },
                &[&win_signer],
            ),
            fee_u64,
        )?;
    }

    // Calculate final payout pool
    ctx.accounts.win_vault.reload()?;
    let payout_total_u128 = pot_u128
        .checked_sub(fees.total_deductions)
        .ok_or(error!(ErrorCode::Overflow))?;
    let payout_u64: u64 = payout_total_u128
        .try_into()
        .map_err(|_| error!(ErrorCode::Overflow))?;

    m.payout_pool = core::cmp::min(payout_u64, ctx.accounts.win_vault.amount);
    m.settled = true;
    m.tentative = false;

    emit!(MarketResolvedAi {
        market: market_key,
        outcome_idx: m.outcome_idx,
        winners_mask: 0,
        pot: pot_u128,
        fee: fees.protocol_fee,
        tip: fees.resolver_tip.checked_add(fees.creator_tip).unwrap(),
        payout_pool: m.payout_pool as u128,
    });

    Ok(())
}

// ============ Multi Winner Logic ============

fn finalize_multi_winner<'info>(
    ctx: Context<'_, '_, 'info, 'info, FinalizeAi<'info>>,
    fees: &FeeBreakdown,
    market_key: Pubkey,
    program_id: &Pubkey,
    mint_key: Pubkey,
    num_outcomes: u8,
    tvl: [u64; crate::constants::MAX_OUTCOMES],
    pot_u128: u128,
) -> Result<()> {
    let m = &mut ctx.accounts.market;
    let mask = m.winners_mask;

    require!(mask != 0 && m.outcome_idx == OUTCOME_NONE, ErrorCode::Unauthorized);
    require!(ctx.remaining_accounts.len() % 2 == 0, ErrorCode::Unauthorized);

    // Build winner PDAs map
    let mut winner_pdas = std::collections::BTreeMap::<Pubkey, (u8, u8)>::new();
    for idx in 0..num_outcomes {
        if (mask & (1 << idx)) != 0 {
            let (pda, bump) = pda_escrow_auth_outcome(&market_key, idx, program_id);
            winner_pdas.insert(pda, (idx, bump));
        }
    }

    // Categorize accounts into winners and losers
    let (winners_pairs, losers) = categorize_accounts(
        ctx.remaining_accounts,
        &winner_pdas,
        mint_key,
        program_id,
        market_key,
        num_outcomes,
        mask,
    )?;

    require!(winners_pairs.len() > 0, ErrorCode::NoWinningBet);

    // Calculate total winner stake
    let total_winners_stake: u128 = (0..num_outcomes)
        .filter(|i| (mask & (1 << i)) != 0)
        .map(|i| tvl[i as usize] as u128)
        .sum();
    require!(total_winners_stake > 0, ErrorCode::NoWinningBet);

    // Distribute loser funds to winners proportionally
    distribute_loser_funds_to_winners(
        &losers,
        &winners_pairs,
        &ctx.accounts.token_program,
        market_key,
        tvl,
        total_winners_stake,
    )?;

    // Calculate total in winner vaults after redistribution
    let mut total_after: u128 = 0;
    for (_, _, _, vault_ai, _) in winners_pairs.iter() {
        let st = SplTokenAccount::unpack(&vault_ai.try_borrow_data()?)
            .map_err(|_| error!(ErrorCode::WrongMint))?;
        total_after = total_after
            .checked_add(st.amount as u128)
            .ok_or(error!(ErrorCode::Overflow))?;
    }

    // Distribute fees and tips from winners proportionally
    distribute_fees_from_winners(
        &winners_pairs,
        fees,
        total_after,
        &ctx.accounts.token_program,
        &ctx.accounts.resolver_ata,
        &ctx.accounts.creator_ata,
        &ctx.accounts.treasury_ata,
        market_key,
    )?;

    // Finalize market state
    m.settled = true;
    m.tentative = false;
    m.payout_pool = 0;

    emit!(MarketResolvedAi {
        market: market_key,
        outcome_idx: OUTCOME_NONE,
        winners_mask: mask,
        pot: pot_u128,
        fee: fees.protocol_fee,
        tip: fees.resolver_tip.checked_add(fees.creator_tip).unwrap(),
        payout_pool: 0,
    });

    Ok(())
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct ResolveAiPropose<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    /// CHECK: Sysvar instructions
    #[account(address = SYSVAR_INSTRUCTIONS_ID)]
    pub ix_sysvar: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FinalizeAi<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub resolver_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_ata.owner == market.authority @ ErrorCode::Unauthorized,
        constraint = creator_ata.mint == mint.key() @ ErrorCode::WrongMint
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = treasury_ata.mint == mint.key(),
        constraint = treasury_ata.owner == market.treasury_wallet_snapshot
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA verified in instruction
    pub win_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub win_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}