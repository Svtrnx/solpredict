use anyhow::{Context, Result};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::task;
use time::OffsetDateTime;

use crate::state::SharedState;
use crate::usecases::{
    perplexity::{MarketNormV8, PerplexityClient},
    market_category::{MarketCategory}
};

pub const AI_JOB_PREFIX: &str = "ai_job:";
pub const AI_JOB_TTL_SECS: u64 = 60u64 * 20;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum AiJobValue {
    #[serde(rename = "pending")]
    Pending { meta: AiJobMeta },
    #[serde(rename = "ready")]
    Ready { data: MarketNormV9, meta: AiJobMeta },
    #[serde(rename = "error")]
    Error { error: String, meta: AiJobMeta },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiJobMeta {
    pub query: String,
    pub category: MarketCategory,
    pub created_at_utc: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketNormV9 {
    pub accept: bool,
    pub reason: String,
    pub proposals: Vec<ProposalWithId>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProposalWithId {
    pub id: String,
    pub topic: String,
    pub description: String,
    pub criteria: String,
    pub end_time_utc: String,
    pub accepted_sources: Vec<String>,
    #[serde(rename = "shortText")]
    pub short_text: String,
}

pub fn compute_hash(query: &str, category: MarketCategory) -> String {
    let mut h = Sha256::new();
    h.update(query.as_bytes());
    h.update(b"|cat:");
    let cat: &str = match category {
        MarketCategory::Politics => "politics",
        MarketCategory::War => "war",
        MarketCategory::Finance => "finance",
        MarketCategory::Sports => "sports",
    };
    h.update(cat.as_bytes());
    format!("{:x}", h.finalize())
}

fn proposal_id(job_hash: &str, idx: usize, short_text: &str) -> String {
    let mut h = Sha256::new();
    h.update(job_hash.as_bytes());
    h.update(b":");
    h.update(idx.to_string().as_bytes());
    h.update(b":");
    h.update(short_text.as_bytes());
    let hex = format!("{:x}", h.finalize());
    hex[..12].to_string()
}

fn attach_ids(job_hash: &str, v8: MarketNormV8) -> MarketNormV9 {
    let proposals = v8
        .proposals
        .into_iter()
        .enumerate()
        .map(|(i, p)| ProposalWithId {
            id: proposal_id(job_hash, i, &p.short_text),
            topic: p.topic,
            description: p.description,
            criteria: p.criteria,
            end_time_utc: p.end_time_utc,
            accepted_sources: p.accepted_sources,
            short_text: p.short_text,
        })
        .collect();

    MarketNormV9 {
        accept: v8.accept,
        reason: v8.reason,
        proposals,
    }
}

pub async fn put_pending(state: &SharedState, hash: &str, meta: AiJobMeta) -> Result<()> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("redis multiplexed conn (pending)")?;

    let value = serde_json::to_string(&AiJobValue::Pending { meta }).unwrap();
    let key = format!("{AI_JOB_PREFIX}{hash}");
    let _: () = conn
        .set_ex(key, value, AI_JOB_TTL_SECS)
        .await
        .context("redis SETEX pending failed")?;
    Ok(())
}

pub async fn put_ready(state: &SharedState, hash: &str, data: MarketNormV9, meta: AiJobMeta) -> Result<()> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("redis multiplexed conn (ready)")?;

    let value = serde_json::to_string(&AiJobValue::Ready { data, meta }).unwrap();
    let key = format!("{AI_JOB_PREFIX}{hash}");
    let _: () = conn
        .set_ex(key, value, AI_JOB_TTL_SECS)
        .await
        .context("redis SETEX ready failed")?;
    Ok(())
}

pub async fn put_error(state: &SharedState, hash: &str, err: &str, meta: AiJobMeta) -> Result<()> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("redis multiplexed conn (error)")?;

    let value =
        serde_json::to_string(&AiJobValue::Error { error: err.to_string(), meta }).unwrap();
    let key = format!("{AI_JOB_PREFIX}{hash}");
    let _: () = conn
        .set_ex(key, value, AI_JOB_TTL_SECS)
        .await
        .context("redis SETEX error failed")?;
    Ok(())
}

pub async fn get_job(state: &SharedState, hash: &str) -> Result<Option<AiJobValue>> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("redis multiplexed conn (get)")?;

    let key = format!("{AI_JOB_PREFIX}{hash}");
    let raw: Option<String> = conn.get(key).await.context("redis GET failed")?;
    Ok(match raw {
        None => None,
        Some(s) => Some(serde_json::from_str::<AiJobValue>(&s).context("invalid AiJobValue json")?),
    })
}

pub fn spawn_normalization_job(
    state: SharedState,
    hash: String,
    query: String,
    category: MarketCategory,
) {
    task::spawn(async move {
        let meta = AiJobMeta {
            query: query.clone(),
            category,
            created_at_utc: OffsetDateTime::now_utc().unix_timestamp(),
        };

        let pplx_key = match std::env::var("PERPLEXITY_API_KEY") {
            Ok(v) if !v.is_empty() => v,
            _ => {
                let _ = put_error(&state, &hash, "PERPLEXITY_API_KEY is not set", meta).await;
                return;
            }
        };

        let client = PerplexityClient::new(pplx_key);

        let outcome = client
            .normalize_market(&query, category)
            .await;

        match outcome {
            Ok(v8) => {
                let v9 = attach_ids(&hash, v8);
                let _ = put_ready(&state, &hash, v9, meta).await;
            }
            Err(e) => {
                let _ = put_error(&state, &hash, &e.to_string(), meta).await;
            }
        }
    });
}
