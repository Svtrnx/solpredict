use serde_json::Value;

use crate::{
    usecases::webhooks::shared::{
        extract_sig, extract_slot, extract_fee_payer, extract_instructions,
        amount_user_from_token_transfers, amount_from_meta_delta,
        accounts_str_and_idx, extract_memo
    },
	repo::market as market_repo,
	error::{AppError},
	usecases::bets,
	state
};

const IXI_USER: usize       = 0;
const IXI_MARKET: usize     = 1;
const IXI_USER_ATA: usize   = 3;

fn memo_side(m: &str) -> Option<bool> {
    m.split('&')
        .find_map(|p| {
            let (k, v) = p.split_once('=')?;
            (k == "s").then_some(matches!(v, "yes" | "y" | "true" | "1"))
        })
}

fn side_from_place_bet_ix(ix: &serde_json::Value) -> Option<bool> {
    let data_b58 = ix.get("data")?.as_str()?;
    let data = bs58::decode(data_b58).into_vec().ok()?;
    if data.len() < 9 { return None; }

    let side = data[8];
    Some(side == 0)
}

pub async fn handle(
    item: &Value,
    this_ix: &Value,
    msg_keys_opt: Option<&[Value]>,
    memo_program: &str,
    usdc_mint: &str,
) -> Result<(), AppError> {
	tracing::info!("handle place_bet");

    let state = state::global();
    let signature = extract_sig(item).unwrap_or("<no-sig>");
    let slot      = extract_slot(item).unwrap_or_default();
    let fee_payer = extract_fee_payer(item).unwrap_or("<no-fee-payer>");

    let (acc_str, acc_idx) = accounts_str_and_idx(this_ix, msg_keys_opt);
    let market_pda = *acc_str.get(IXI_MARKET).unwrap_or(&"<unknown>");
    let user_from_accounts = *acc_str.get(IXI_USER).unwrap_or(&fee_payer);

    let (ixs, msg_keys_opt) = extract_instructions(item);
    let memo = extract_memo(&ixs, msg_keys_opt, memo_program);
	
	let side_yes = side_from_place_bet_ix(this_ix)
        .or_else(|| memo.as_deref().and_then(memo_side))
        .unwrap_or(true);

    let amount_and_user: Option<(f64, &str)> = 
        if let Some((amount_ui, from)) = amount_user_from_token_transfers(item, usdc_mint) {
            let user = if !from.is_empty() { from } else { user_from_accounts };
            Some((amount_ui, user))
        } else if let Some(user_ata_idx) = acc_idx.get(IXI_USER_ATA).copied() {
            if user_ata_idx != usize::MAX {
                if let Some(amount_ui) = amount_from_meta_delta(item, user_ata_idx, usdc_mint) {
                    Some((amount_ui, user_from_accounts))
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

    if let Some((amount_ui, user)) = amount_and_user {
        tracing::info!(
            "🧾 place_bet sig={} slot={} market={} user={} amount_usdc={} memo={:?} (feePayer={})",
            signature, slot, market_pda, user, amount_ui, memo, fee_payer
        );

        let m = market_repo::fetch_by_pda(state.db.pool(), market_pda)
            .await
            .map_err(|e| AppError::Other(e.into()))?
            .ok_or_else(|| AppError::NotFound)?;
		
        bets::record_bet_and_points(
            state.db.pool(),
            m.id,
            user,
            side_yes,
            (amount_ui * 1_000_000.0) as i64,
            signature,
        )
        .await
        .map_err(|e| AppError::Other(e.into()))?;

        return Ok(());
    }

    tracing::info!(
        "place_bet sig={} slot={} market={} user={} amount_usdc=0 memo={:?} (feePayer={})",
        signature, slot, market_pda, user_from_accounts, memo, fee_payer
    );

    Ok(())
}


