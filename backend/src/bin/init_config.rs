use std::str::FromStr;
use anyhow::Result;

use solpredict::solana::anchor_client as anchor_client_;
use anchor_client::solana_sdk::pubkey::Pubkey;

fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let ctx = anchor_client_::connect_devnet()?;

    let admin = &*ctx.payer;

    let treasury = Pubkey::from_str(&std::env::var("TREASURY")
        .expect("set TREASURY=<pubkey>"))?;
    let fee_bps: u16 = std::env::var("FEE_BPS").expect("set FEE_BPS").parse()?;
    let resolver_bps: u16 = std::env::var("RESOLVER_BPS").expect("set RESOLVER_BPS").parse()?;
    let tip_cap: u64 = std::env::var("TIP_CAP").expect("set TIP_CAP").parse()?;

    let sig = anchor_client_::init_config(&ctx, admin, treasury, fee_bps, resolver_bps, tip_cap)?;
    println!("init_config OK: {}", sig);

    Ok(())
}
