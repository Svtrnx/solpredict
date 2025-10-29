use serde::{Deserialize, Deserializer};
use anyhow::{anyhow, Context};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use std::str::FromStr;
use serde_json::Value;

use crate::{
    usecases::webhooks::shared::{
        extract_sig, extract_slot, extract_fee_payer, extract_instructions,
        accounts_str_and_idx, extract_memo,
    },
    handlers::market::types::{
        MarketType, MarketCategory, SeedSide, Comparator, CreateMarketRequest,
        resolve_price_feed_account_from_hex, usd_to_1e6
    },
    usecases::market_category::MarketCategory as MarketCategoryAi,
    usecases::ai_jobs::{get_job, AiJobValue},
    repo::{market as market_repo},
    error::AppError,
    state,
};

const IXI_USER: usize = 0;
const IXI_MARKET: usize = 1;

#[derive(Debug, Deserialize)]
struct AiMemoMin {
    k: String, 
    h: String,
    p: String,
}

impl FromStr for MarketCategory {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "crypto" => Ok(MarketCategory::Crypto),
            _ => Err(()),
        }
    }
}

impl FromStr for MarketType {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "threshold" => Ok(MarketType::PriceThreshold),
            "range" => Ok(MarketType::PriceRange),
            _ => Err(()),
        }
    }
}

impl FromStr for SeedSide {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "yes" => Ok(SeedSide::Yes),
            "no" => Ok(SeedSide::No),
            _ => Err(()),
        }
    }
}

impl FromStr for Comparator {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            ">=" => Comparator::Gte,
            ">"  => Comparator::Gt,
            "<=" => Comparator::Lte,
            "<"  => Comparator::Lt,
            "="  => Comparator::Eq,
            ""   => Comparator::Empty,
            _    => Comparator::Empty,
        })
    }
}

fn de_opt_from_str<'de, D, T>(de: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: std::str::FromStr,
{
    let opt = Option::<String>::deserialize(de)?;
    Ok(match opt {
        Some(s) if !s.is_empty() => Some(
            s.parse::<T>()
                .map_err(|_| serde::de::Error::custom(format!("invalid value for {}", std::any::type_name::<T>())))?
        ),
        _ => None,
    })
}

fn de_opt_ts<'de, D>(de: D) -> Result<Option<time::OffsetDateTime>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<i64>::deserialize(de)?;
    Ok(match opt {
        Some(ts) => Some(
            time::OffsetDateTime::from_unix_timestamp(ts)
                .map_err(serde::de::Error::custom)?
        ),
        None => None,
    })
}

#[derive(Debug, Deserialize)]
struct MemoData {
    #[serde(default)]
    t: String,

    #[serde(default, deserialize_with = "de_opt_from_str")]
    ca: Option<MarketCategory>,
    #[serde(default, deserialize_with = "de_opt_from_str")]
    co: Option<Comparator>,
    #[serde(rename = "eD", default, deserialize_with = "de_opt_ts")]
    end_date: Option<OffsetDateTime>,
    #[serde(default)]
    f: Option<String>, // feed_id
    #[serde(rename = "iL", default)]
    initial_liquidity: Option<f64>,
    #[serde(rename = "iS", default, deserialize_with = "de_opt_from_str")]
    initial_side: Option<SeedSide>,
    #[serde(default, deserialize_with = "de_opt_from_str")]
    mt: Option<MarketType>,
    #[serde(default)]
    s: Option<String>, // symbol
    #[serde(rename = "lB", default)]
    lower_bound: Option<f64>,
    #[serde(rename = "uB", default)]
    upper_bound: Option<f64>,
    #[serde(default)]
    th: Option<f64>,
}

fn parse_create_market_memo(memo: &str) -> Result<MemoData, AppError> {
    let m: MemoData = serde_urlencoded::from_str(memo)
        .map_err(|e| AppError::Other(anyhow!("bad memo: {e}")))?;
    if m.t != "create_market" {
        tracing::warn!("unexpected memo.t = {}", m.t);
    }
    Ok(m)
}

/// === PYTH ===
pub async fn handle(
    item: &Value,
    this_ix: &Value,
    msg_keys_opt: Option<&[Value]>,
    memo_program: &str,
    usdc_mint: &str,
) -> Result<(), AppError> {
    tracing::info!("handle create_market (pyth)");

    let state = state::global();
    let signature   = extract_sig(item).unwrap_or("<no-sig>");
    let slot        = extract_slot(item).unwrap_or_default();
    let fee_payer   = extract_fee_payer(item).unwrap_or("<no-fee-payer>");

    let (acc_str, _) = accounts_str_and_idx(this_ix, msg_keys_opt);
    let market_pda          = *acc_str.get(IXI_MARKET).unwrap_or(&"<unknown>");
    let user_from_accounts  = *acc_str.get(IXI_USER).unwrap_or(&fee_payer);

    let (ixs, msg_keys_opt) = extract_instructions(item);

    let memo_raw = extract_memo(&ixs, msg_keys_opt, memo_program);
    tracing::info!("create_market memo: {:?}", memo_raw);
    let m = memo_raw
        .as_deref()
        .map(parse_create_market_memo)
        .transpose()?
        .ok_or_else(|| AppError::bad_request("create_market: memo is missing"))?;
    tracing::info!("parsed create_market memo: {:?}", m);

    let market_type = m.mt.ok_or_else(|| AppError::bad_request("memo.mt required"))?;
    let category    = m.ca.unwrap_or(MarketCategory::Crypto);
    let comparator  = m.co.unwrap_or(Comparator::Gt);
    let end_date    = m.end_date.ok_or_else(|| AppError::bad_request("memo.eD required"))?;
    let initial_liquidity = m.initial_liquidity.unwrap_or(0.0);
    let initial_side      = m.initial_side.unwrap_or(SeedSide::Yes);
    let feed_id = m.f.ok_or_else(|| AppError::bad_request("memo.f (feed_id) required"))?;
    let symbol  = m.s.unwrap_or_else(|| "Crypto.???/USD".to_string());

    let authority = user_from_accounts;

    let (threshold, lower_bound, upper_bound) = match market_type {
        MarketType::PriceThreshold => {
            let th = m.th.ok_or_else(|| AppError::bad_request("memo.th required for threshold"))?;
            (Some(th), None, None)
        }
        MarketType::PriceRange => {
            let lo = m.lower_bound.ok_or_else(|| AppError::bad_request("memo.lB required for range"))?;
            let hi = m.upper_bound.ok_or_else(|| AppError::bad_request("memo.uB required for range"))?;
            (None, Some(lo), Some(hi))
        }
    };

    let req_create = CreateMarketRequest {
        market_type,
        category,
        end_date,
        initial_liquidity,
        initial_side,
        feed_id: feed_id.clone(),
        symbol: symbol.clone(),
        comparator,
        threshold,
        lower_bound,
        upper_bound,
    };

    let (exp_lo, exp_hi) = match market_type {
        MarketType::PriceThreshold => {
            let t = threshold.ok_or_else(|| AppError::bad_request("threshold missing"))?;
            (usd_to_1e6(t), 0)
        }
        MarketType::PriceRange => {
            let lo = lower_bound.ok_or_else(|| AppError::bad_request("lower_bound missing"))?;
            let hi = upper_bound.ok_or_else(|| AppError::bad_request("upper_bound missing"))?;
            (usd_to_1e6(lo), usd_to_1e6(hi))
        }
    };

    let price_feed_pubkey = resolve_price_feed_account_from_hex(&feed_id)
        .map_err(|e| AppError::bad_request(&format!("Cannot resolve price account: {e}")))?;
    let price_feed_b58 = price_feed_pubkey.to_string();
    let mint_b58       = usdc_mint.to_string();

    let market_id = market_repo::insert_confirmed_market(
        state.db.pool(),
        &req_create,
        &market_pda.to_string(),
        &authority.to_string(),
        &signature,
        &price_feed_b58,
        &mint_b58,
        exp_lo,
        exp_hi,
    )
    .await
    .map_err(AppError::Other)?;

    market_repo::upsert_initial_state(
        state.db.pool(),
        market_id,
        0, 0, 0,
    )
    .await
    .map_err(AppError::Other)?;

    tracing::info!(
        "market (pyth) inserted id={} pda={} creator={} sig={} slot={}",
        market_id,
        market_pda,
        authority,
        signature,
        slot
    );

    Ok(())
}

/// === AI (CreateMarketMulti) ===
pub async fn handle_multi(
    item: &Value,
    this_ix: &Value,
    msg_keys_opt: Option<&[Value]>,
    memo_program: &str,
    _usdc_mint: &str,
) -> Result<(), AppError> {
    tracing::info!("handle create_market_multi (ai)");

    let state = state::global();

    let signature = extract_sig(item).unwrap_or("<no-sig>");
    let slot      = extract_slot(item).unwrap_or_default();
    let fee_payer = extract_fee_payer(item).unwrap_or("<no-fee-payer>");

    let (acc_str, _) = accounts_str_and_idx(this_ix, msg_keys_opt);
    let market_pda = *acc_str.get(IXI_MARKET).unwrap_or(&"<unknown>");
    let authority  = *acc_str.get(IXI_USER).unwrap_or(&fee_payer);

    let (ixs, msg_keys_opt2) = extract_instructions(item);
    let memo_raw = extract_memo(&ixs, msg_keys_opt2, memo_program)
        .ok_or_else(|| AppError::bad_request("create_market_multi: MEMO missing for AI"))?;

    let ai_memo: AiMemoMin = serde_json::from_str(&memo_raw)
        .map_err(|e| AppError::bad_request(&format!("create_market_multi: bad AI memo json: {e}")))?;
    if ai_memo.k != "ai1" {
        return Err(AppError::bad_request("create_market_multi: memo.k != 'ai1'"));
    }

    let job_opt = get_job(state, &ai_memo.h).await.map_err(AppError::Other)?;
    let job = match job_opt {
        None => return Err(AppError::bad_request("create_market_multi: job not found/expired in Redis")),
        Some(v) => v,
    };

    let (category, proposal) = match job {
        AiJobValue::Ready { data, meta } => {
            if !data.accept {
                return Err(AppError::bad_request(&format!(
                    "create_market_multi: validator rejected. reason={}", data.reason
                )));
            }
            let p = data.proposals
                .into_iter()
                .find(|pp| pp.id == ai_memo.p)
                .ok_or_else(|| AppError::bad_request("create_market_multi: proposal id not found in job"))?;
            (meta.category, p)
        }
        AiJobValue::Pending { .. } => {
            return Err(AppError::bad_request("create_market_multi: job still pending"))
        }
        AiJobValue::Error { error, .. } => {
            return Err(AppError::bad_request(&format!("create_market_multi: job error: {error}")))
        }
    };

    let category_text = match category {
        MarketCategoryAi::Politics => "politics",
        MarketCategoryAi::War      => "war",
    };

    let end_dt = OffsetDateTime::parse(&proposal.end_time_utc, &Rfc3339)
        .context("bad proposal.end_time_utc")
        .map_err(AppError::Other)?;

    let market_id = market_repo::insert_confirmed_market_ai(
        state.db.pool(),
        &market_pda.to_string(),
        &authority.to_string(),
        signature,             // tx_sig_create
        category_text,         // markets.category
        end_dt,                // markets.end_date_utc
        &ai_memo.h,            // ai_job_hash
        &ai_memo.p,            // ai_proposal_id
        &proposal.topic,
        &proposal.description,
        &proposal.criteria,
        &proposal.accepted_sources,
        &proposal.short_text,
    )
    .await
    .map_err(AppError::Other)?;

    market_repo::upsert_initial_state(
        state.db.pool(),
        market_id,
        0, 0, 0,
    )
    .await
    .map_err(AppError::Other)?;

    tracing::info!(
        target: "webhook_ai",
        "market (ai) inserted id={} pda={} creator={} sig={} slot={} cat={} short='{}'",
        market_id,
        market_pda,
        authority,
        signature,
        slot,
        category_text,
        proposal.short_text
    );

    Ok(())
}
