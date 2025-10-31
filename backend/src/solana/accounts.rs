use super::context::{AnchorCtx, program};
use super::pda::{pda_position, pda_position_multi, pda_config};
use anchor_client::solana_sdk::pubkey::Pubkey;
use anyhow::Result;
use std::sync::Arc;
use prediction_market_program as onchain;

/// Fetch position account for binary markets
pub fn get_position_account(
    ctx: &AnchorCtx,
    market_pda: Pubkey,
    user: Pubkey,
) -> Result<onchain::state::position::PositionBin> {
    let program = program(ctx)?;
    let (pos_pda, _) = pda_position(&market_pda, &user);
    let acc: onchain::state::position::PositionBin = program
        .account(pos_pda)
        .map_err(|e| anyhow::anyhow!("position(bin) fetch failed: {e}"))?;
    Ok(acc)
}

/// Fetch position account for multi-outcome markets
pub fn get_position_multi_account(
    ctx: &AnchorCtx,
    market_pda: Pubkey,
    user: Pubkey,
    outcome_idx: u8,
) -> Result<onchain::state::position::PositionMulti> {
    let program = program(ctx)?;
    let (pos_pda, _) = pda_position_multi(&market_pda, &user, outcome_idx);
    let acc: onchain::state::position::PositionMulti = program
        .account(pos_pda)
        .map_err(|e| anyhow::anyhow!("position(multi) fetch failed: {e}"))?;
    Ok(acc)
}

/// Fetch config account
pub fn get_config_account(ctx: &AnchorCtx) -> Result<onchain::state::config::Config> {
    let program = program(ctx)?;
    let (config_pda, _) = pda_config();
    let acc: onchain::state::config::Config = program
        .account(config_pda)
        .map_err(|e| anyhow::anyhow!("config account fetch failed: {e}"))?;
    Ok(acc)
}

/// Fetch market account synchronously
pub fn get_market_account(ctx: &AnchorCtx, market_pda: Pubkey) -> Result<onchain::state::market::Market> {
    let program = program(ctx)?;
    let acc: onchain::state::market::Market = program
        .account(market_pda)
        .map_err(|e| anyhow::anyhow!("market account fetch failed: {e}"))?;
    Ok(acc)
}

/// Fetch market account asynchronously
pub async fn fetch_market_account(
    ctx: Arc<AnchorCtx>,
    market_pda: Pubkey,
) -> Result<onchain::state::market::Market> {
    tokio::task::spawn_blocking(move || get_market_account(ctx.as_ref(), market_pda))
        .await
        .map_err(|e| anyhow::anyhow!("join error: {e}"))?
}

/// Market snapshot with essential resolution data
#[derive(Debug, Clone)]
pub struct MarketSnapshot {
    pub settled: bool,
    pub winning_side: Option<i16>,      // 1=YES, 2=NO, 3=VOID
    pub resolved_price_1e6: Option<i64>,
    pub payout_pool_1e6: Option<i64>,
}

/// Extract snapshot from market account
pub fn snapshot_from_market(m: &onchain::state::market::Market) -> MarketSnapshot {
    let winning_side: Option<i16> = if m.settled {
        match m.winning_side {
            1 => Some(1), // YES
            2 => Some(2), // NO
            3 => Some(3), // VOID
            _ => None,
        }
    } else {
        None
    };

    let resolved_price_1e6 = if m.resolved_price_1e6 == 0 {
        None
    } else {
        Some(m.resolved_price_1e6)
    };
    let payout_pool_1e6 = Some(m.payout_pool as i64);

    MarketSnapshot {
        settled: m.settled,
        winning_side,
        resolved_price_1e6,
        payout_pool_1e6,
    }
}

/// Fetch market snapshot asynchronously
pub async fn fetch_market_snapshot(
    ctx: Arc<AnchorCtx>,
    market_pda: Pubkey,
) -> Result<MarketSnapshot> {
    let m = fetch_market_account(ctx, market_pda).await?;
    Ok(snapshot_from_market(&m))
}
