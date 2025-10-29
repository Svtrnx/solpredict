use anchor_client::solana_client::nonblocking::rpc_client::RpcClient;
use anchor_client::solana_sdk::signature::Signature;
use anyhow::{Context, Result};
use std::{str::FromStr, time::Duration};
use tokio::time::sleep;

const POLL_INTERVAL: Duration = Duration::from_millis(500);
const MAX_ATTEMPTS: usize = 30;

/// Wait for transaction confirmation with polling
pub async fn wait_for_confirmation(sig_str: &str, rpc: &RpcClient) -> Result<()> {
    let sig = Signature::from_str(sig_str).context("invalid signature format")?;

    for _ in 1..=MAX_ATTEMPTS {
        let statuses = rpc
            .get_signature_statuses(&[sig])
            .await
            .context("failed to fetch signature statuses")?;

        if let Some(Some(status)) = statuses.value.into_iter().next() {
            if status.err.is_none() {
                return Ok(());
            } else {
                return Err(anyhow::anyhow!(
                    "transaction {} failed: {:?}",
                    sig_str,
                    status.err
                ));
            }
        }

        sleep(POLL_INTERVAL).await;
    }

    Err(anyhow::anyhow!(
        "transaction {} not confirmed after {} attempts (~{}s)",
        sig_str,
        MAX_ATTEMPTS,
        POLL_INTERVAL.as_secs_f32() * MAX_ATTEMPTS as f32
    ))
}
