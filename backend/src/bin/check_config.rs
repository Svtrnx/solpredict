use anyhow::Result;
use solpredict::solana as anchor_client_;

fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let ctx = anchor_client_::connect_devnet()?;

    match anchor_client_::get_config_account(&ctx) {
        Ok(config) => {
            println!("Config account exists and is valid!");
            println!("   Admin: {}", config.admin);
            println!("   Treasury: {}", config.treasury_wallet);
            println!("   Fee BPS: {}", config.fee_bps);
            println!("   Resolver BPS: {}", config.resolver_bps);
            println!("   Creator BPS: {}", config.creator_bps);
            println!("   Tip Cap: {}", config.resolver_tip_cap);
            Ok(())
        }
        Err(e) => {
            println!("Config account exists but is invalid:");
            println!("   Error: {}", e);
            Err(e)
        }
    }
}
