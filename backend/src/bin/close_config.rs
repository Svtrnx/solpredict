use anyhow::Result;
use solpredict::solana as anchor_client_;

fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let ctx = anchor_client_::connect_devnet()?;
    let admin = &*ctx.payer;

    let sig = anchor_client_::close_config(&ctx, admin)?;
    println!("close_config OK: {}", sig);

    Ok(())
}
