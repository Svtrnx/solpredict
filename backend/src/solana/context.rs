use anchor_client::{Client, Cluster, Program};
use anyhow::Result;
use std::sync::Arc;

use anchor_client::solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{read_keypair_file, Keypair},
    pubkey::Pubkey,
};

use prediction_market_program as onchain;

/// Anchor client context containing connection and payer info
pub struct AnchorCtx {
    pub client: Client<Arc<Keypair>>,
    pub payer: Arc<Keypair>,
    pub program_id: Pubkey,
}

/// Connect to Solana devnet with default keypair
pub fn connect_devnet() -> Result<AnchorCtx> {
    let kp_path = shellexpand::tilde("~/.config/solana/id.json").to_string();
    let payer = Arc::new(
        read_keypair_file(&kp_path)
            .map_err(|e| anyhow::anyhow!("failed to read keypair {kp_path}: {e}"))?,
    );
    
    let client = Client::new_with_options(
        Cluster::Devnet,
        payer.clone(),
        CommitmentConfig::processed(),
    );
    
    Ok(AnchorCtx {
        client,
        payer,
        program_id: onchain::ID,
    })
}

/// Get the Anchor program instance from context
pub fn program(ctx: &AnchorCtx) -> Result<Program<Arc<Keypair>>> {
    Ok(ctx.client.program(ctx.program_id)?)
}
