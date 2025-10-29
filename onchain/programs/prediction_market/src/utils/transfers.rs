use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use spl_token::state::Account as SplTokenAccount;
use std::collections::BTreeMap;
use anchor_lang::solana_program::{program_pack::Pack};
use crate::{
    constants::{ESCROW_SEED, MAX_OUTCOMES, OUTCOME_PREFIX},
    errors::ErrorCode,
    utils::{fees::FeeBreakdown, pda::outcome_signer_seeds},
};

/// Transfer all losing stakes to the winner vault (single winner)
pub fn transfer_losers_to_winner<'info>(
    remaining_accounts: &[AccountInfo<'info>],
    token_program: &Program<'info, Token>,
    win_vault: &Account<'info, TokenAccount>,
    market_key: Pubkey,
    program_id: &Pubkey,
    mint_key: Pubkey,
    num_outcomes: u8,
    win_idx: u8,
) -> Result<()> {
    for pair in remaining_accounts.chunks(2) {
        require!(pair.len() == 2, ErrorCode::Unauthorized);
        let lose_auth_ai = pair[0].clone();
        let lose_vault_ai = pair[1].clone();

        let lose_state = SplTokenAccount::unpack(&lose_vault_ai.try_borrow_data()?)
            .map_err(|_| error!(ErrorCode::WrongMint))?;
        require_keys_eq!(lose_state.mint, mint_key, ErrorCode::WrongMint);
        require_keys_eq!(lose_state.owner, lose_auth_ai.key(), ErrorCode::Unauthorized);

        // Find loser index
        let mut matched: Option<(u8, u8)> = None;
        for idx in 0..num_outcomes {
            if idx == win_idx {
                continue;
            }
            let (pda, bump) = Pubkey::find_program_address(
                &[ESCROW_SEED, market_key.as_ref(), OUTCOME_PREFIX, &[idx]],
                program_id,
            );
            if pda == lose_auth_ai.key() {
                matched = Some((idx, bump));
                break;
            }
        }
        let (loser_idx, loser_bump) = matched.ok_or(error!(ErrorCode::Unauthorized))?;

        let amount = lose_state.amount;
        if amount > 0 {
            let idx_arr = [loser_idx];
            let bump_arr = [loser_bump];
            let lose_signer = outcome_signer_seeds(&market_key, &idx_arr, &bump_arr);

            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: lose_vault_ai,
                        to: win_vault.to_account_info(),
                        authority: lose_auth_ai,
                    },
                    &[&lose_signer],
                ),
                amount,
            )?;
        }
    }

    Ok(())
}

/// Categorize remaining accounts into winners and losers
pub fn categorize_accounts<'info>(
    remaining_accounts: &[AccountInfo<'info>],
    winner_pdas: &BTreeMap<Pubkey, (u8, u8)>,
    mint_key: Pubkey,
    program_id: &Pubkey,
    market_key: Pubkey,
    num_outcomes: u8,
    mask: u8,
) -> Result<(
    Vec<(u8, u8, AccountInfo<'info>, AccountInfo<'info>, u64)>,
    Vec<(AccountInfo<'info>, AccountInfo<'info>, u8, u8, u64)>,
)> {
    let pairs: Vec<[AccountInfo<'info>; 2]> = remaining_accounts
        .chunks(2)
        .map(|c| [c[0].clone(), c[1].clone()])
        .collect();

    let mut winners_pairs = Vec::new();
    let mut losers = Vec::new();

    for [auth_ai, vault_ai] in pairs.into_iter() {
        let st = SplTokenAccount::unpack(&vault_ai.try_borrow_data()?)
            .map_err(|_| error!(ErrorCode::WrongMint))?;
        require_keys_eq!(st.mint, mint_key, ErrorCode::WrongMint);
        require_keys_eq!(st.owner, auth_ai.key(), ErrorCode::Unauthorized);

        if let Some(&(idx, bump)) = winner_pdas.get(&auth_ai.key()) {
            winners_pairs.push((idx, bump, auth_ai, vault_ai, st.amount));
        } else {
            // Find loser index
            let mut matched: Option<(u8, u8)> = None;
            for idx in 0..num_outcomes {
                if (mask & (1 << idx)) != 0 {
                    continue;
                }
                let (pda, bump) = Pubkey::find_program_address(
                    &[ESCROW_SEED, market_key.as_ref(), OUTCOME_PREFIX, &[idx]],
                    program_id,
                );
                if pda == auth_ai.key() {
                    matched = Some((idx, bump));
                    break;
                }
            }
            let (loser_idx, loser_bump) = matched.ok_or(error!(ErrorCode::Unauthorized))?;
            losers.push((auth_ai, vault_ai, loser_idx, loser_bump, st.amount));
        }
    }

    Ok((winners_pairs, losers))
}

/// Distribute loser funds to winners proportionally
pub fn distribute_loser_funds_to_winners<'info>(
    losers: &[(AccountInfo<'info>, AccountInfo<'info>, u8, u8, u64)],
    winners_pairs: &[(u8, u8, AccountInfo<'info>, AccountInfo<'info>, u64)],
    token_program: &Program<'info, Token>,
    market_key: Pubkey,
    tvl: [u64; MAX_OUTCOMES],
    total_winners_stake: u128,
) -> Result<()> {
    for (lose_auth_ai, lose_vault_ai, loser_idx, loser_bump, lose_amt) in losers.iter() {
        if *lose_amt == 0 {
            continue;
        }

        let mut acc: u128 = 0;
        let idx_arr = [*loser_idx];
        let bump_arr = [*loser_bump];
        let lose_signer = outcome_signer_seeds(&market_key, &idx_arr, &bump_arr);

        for i in 0..winners_pairs.len() {
            let (idx, _bump, _wauth, wvault_ai, _) = &winners_pairs[i];

            // Calculate share
            let share_u128 = if i + 1 == winners_pairs.len() {
                (*lose_amt as u128)
                    .checked_sub(acc)
                    .ok_or(error!(ErrorCode::Overflow))?
            } else {
                // Proportional to winner's stake
                let s = (*lose_amt as u128)
                    .checked_mul(tvl[*idx as usize] as u128)
                    .ok_or(error!(ErrorCode::Overflow))?
                    / total_winners_stake;
                acc = acc.checked_add(s).ok_or(error!(ErrorCode::Overflow))?;
                s
            };

            let share_u64: u64 = share_u128.try_into().unwrap_or(u64::MAX);
            if share_u64 > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        Transfer {
                            from: lose_vault_ai.to_account_info(),
                            to: wvault_ai.to_account_info(),
                            authority: lose_auth_ai.to_account_info(),
                        },
                        &[&lose_signer],
                    ),
                    share_u64,
                )?;
            }
        }
    }

    Ok(())
}

/// Distribute fees and tips from winners proportionally
pub fn distribute_fees_from_winners<'info>(
    winners_pairs: &[(u8, u8, AccountInfo<'info>, AccountInfo<'info>, u64)],
    fees: &FeeBreakdown,
    total_after: u128,
    token_program: &Program<'info, Token>,
    resolver_ata: &Account<'info, TokenAccount>,
    creator_ata: &Account<'info, TokenAccount>,
    treasury_ata: &Account<'info, TokenAccount>,
    market_key: Pubkey,
) -> Result<()> {
    let (fee_total_u64, resolver_total_u64, creator_total_u64) = fees.to_u64_parts()?;

    let mut resolver_left = resolver_total_u64;
    let mut creator_left = creator_total_u64;
    let mut fee_left = fee_total_u64;

    for i in 0..winners_pairs.len() {
        let (idx, bump, wauth_ai, wvault_ai, _) = &winners_pairs[i];
        let st = SplTokenAccount::unpack(&wvault_ai.try_borrow_data()?)
            .map_err(|_| error!(ErrorCode::WrongMint))?;
        let cur = st.amount;

        if cur == 0 {
            continue;
        }

        let is_last = i + 1 == winners_pairs.len();

        // Calculate proportional shares
        let share_resolver = if is_last {
            resolver_left
        } else {
            let s = (resolver_total_u64 as u128)
                .checked_mul(cur as u128)
                .ok_or(error!(ErrorCode::Overflow))?
                / total_after;
            let s_u64: u64 = s.try_into().unwrap_or(u64::MAX);
            resolver_left = resolver_left.saturating_sub(s_u64);
            s_u64
        };

        let share_creator = if is_last {
            creator_left
        } else {
            let s = (creator_total_u64 as u128)
                .checked_mul(cur as u128)
                .ok_or(error!(ErrorCode::Overflow))?
                / total_after;
            let s_u64: u64 = s.try_into().unwrap_or(u64::MAX);
            creator_left = creator_left.saturating_sub(s_u64);
            s_u64
        };

        let share_fee = if is_last {
            fee_left
        } else {
            let s = (fee_total_u64 as u128)
                .checked_mul(cur as u128)
                .ok_or(error!(ErrorCode::Overflow))?
                / total_after;
            let s_u64: u64 = s.try_into().unwrap_or(u64::MAX);
            fee_left = fee_left.saturating_sub(s_u64);
            s_u64
        };

        let idx_arr = [*idx];
        let bump_arr = [*bump];
        let win_signer = outcome_signer_seeds(&market_key, &idx_arr, &bump_arr);

        // Transfer resolver tip
        if share_resolver > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: wvault_ai.to_account_info(),
                        to: resolver_ata.to_account_info(),
                        authority: wauth_ai.to_account_info(),
                    },
                    &[&win_signer],
                ),
                share_resolver,
            )?;
        }

        // Transfer creator tip
        if share_creator > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: wvault_ai.to_account_info(),
                        to: creator_ata.to_account_info(),
                        authority: wauth_ai.to_account_info(),
                    },
                    &[&win_signer],
                ),
                share_creator,
            )?;
        }

        // Transfer protocol fee
        if share_fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: wvault_ai.to_account_info(),
                        to: treasury_ata.to_account_info(),
                        authority: wauth_ai.to_account_info(),
                    },
                    &[&win_signer],
                ),
                share_fee,
            )?;
        }
    }

    Ok(())
}