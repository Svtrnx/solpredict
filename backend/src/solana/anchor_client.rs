use anchor_client::solana_client::nonblocking::rpc_client::RpcClient;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::sysvar;
use anchor_client::solana_sdk::{
    hash::Hash,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::{Signature, read_keypair_file},
    signer::{Signer, keypair::Keypair},
    system_program,
    transaction::Transaction,
};
use anchor_client::{Client, Cluster, Program};
use anyhow::{Context, Result};
use base64::{Engine, engine::general_purpose};
use bincode::{config::standard, serde::encode_to_vec};
use prediction_market_program as onchain;

use anchor_spl::associated_token::{
    self, ID as ASSOCIATED_TOKEN_PROGRAM_ID, get_associated_token_address,
};
use spl_associated_token_account::instruction as ata_ix;
use anchor_spl::token::{self, ID as TOKEN_PROGRAM_ID};

use std::sync::Arc;
use std::{str::FromStr, time::Duration};
use tokio::time::sleep;
use spl_memo::build_memo;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct AnchorCtx {
    pub client: Client<Arc<Keypair>>,
    pub payer: Arc<Keypair>,
    pub program_id: Pubkey,
}

const SIDE_YES: &[u8] = b"yes";
const SIDE_NO: &[u8] = b"no";

// ==== PDA helpers ====

fn pda_market(user: &Pubkey, feed: &Pubkey, end_ts: i64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"market",
            user.as_ref(),
            feed.as_ref(),
            &end_ts.to_le_bytes(),
        ],
        &onchain::ID,
    )
}

const POLL_INTERVAL: Duration = Duration::from_millis(500);
const MAX_ATTEMPTS: usize = 30;

pub async fn wait_for_confirmation(sig_str: &str, rpc: &RpcClient) -> Result<()> {
    let sig = Signature::from_str(sig_str).context("invalid signature format")?;
    // let rpc = RpcClient::new(rpc_url.to_string());

    for attempt in 1..=MAX_ATTEMPTS {
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

fn pda_escrow_auth(market: &Pubkey, side: &[u8]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"escrow-auth", market.as_ref(), side], &onchain::ID)
}

fn pda_config() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], &onchain::ID)
}

fn pda_position(market: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"position", market.as_ref(), user.as_ref()], &onchain::ID)
}

// RPC helpers
fn latest_blockhash(program: &Program<Arc<Keypair>>) -> anyhow::Result<Hash> {
    Ok(program.rpc().get_latest_blockhash()?)
}

// Encode unsigned tx (bincode -> base64) to send it to the client
pub fn encode_unsigned_tx(tx: &Transaction) -> anyhow::Result<String> {
    let bytes =
        encode_to_vec(tx, standard()).map_err(|e| anyhow::anyhow!("bincode encode failed: {e}"))?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

// ==== Connection / Program ====

pub fn connect_devnet() -> Result<AnchorCtx> {
    // Read payer from standard Solana keypair location
    let kp_path = shellexpand::tilde("~/.config/solana/id.json").to_string();
    let payer = Arc::new(
        read_keypair_file(&kp_path)
            .map_err(|e| anyhow::anyhow!("failed to read keypair {kp_path}: {e}"))?,
    );
    // Use processed commitment for responsiveness
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

fn program(ctx: &AnchorCtx) -> anyhow::Result<Program<Arc<Keypair>>> {
    Ok(ctx.client.program(ctx.program_id)?)
}

// ==== Devnet USDC airdrop (only one time) ====

pub fn airdrop_usdc_once(ctx: &AnchorCtx, user: Pubkey) -> anyhow::Result<Signature> {
    let program = program(ctx)?;
    let mint = Pubkey::from_str("5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh")?;

    let (mint_auth_pda, _) = Pubkey::find_program_address(&[b"mint-auth"], &onchain::ID);
    let (claim_pda, _) = Pubkey::find_program_address(&[b"claim", user.as_ref()], &onchain::ID);
    let user_ata = get_associated_token_address(&user, &mint);

    let sig = program
        .request()
        .accounts(onchain::accounts::AirdropOnce {
            user,
            payer: ctx.payer.pubkey(),
            mint,
            mint_authority: mint_auth_pda,
            user_ata,
            claim: claim_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::AirdropOnce {})
        .signer(&*ctx.payer)
        .send()?;

    Ok(sig)
}

// ==== Token metadata (Metaplex) USDC Mint ====

pub fn set_token_metadata(ctx: &AnchorCtx, uri: &str) -> anyhow::Result<Signature> {
    use std::str::FromStr;

    let program = program(ctx)?;
    let mint = Pubkey::from_str("5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh")?;
    let (mint_auth_pda, _) = Pubkey::find_program_address(&[b"mint-auth"], &onchain::ID);

    // Metaplex Token Metadata program id
    let tm_prog: Pubkey = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        .parse()
        .unwrap();

    // metadata PDA: ["metadata", tm_prog, mint]
    let (metadata_pda, _) =
        Pubkey::find_program_address(&[b"metadata", tm_prog.as_ref(), mint.as_ref()], &tm_prog);

    let sig = program
        .request()
        .accounts(onchain::accounts::SetMetadata {
            payer: ctx.payer.pubkey(),
            mint,
            mint_authority: mint_auth_pda,
            metadata: metadata_pda,
            token_metadata_program: tm_prog,
            system_program: system_program::ID,
            rent: anchor_client::solana_sdk::sysvar::rent::ID,
        })
        .args(onchain::instruction::SetMetadata {
            uri: uri.to_string(),
        })
        .signer(&*ctx.payer)
        .send()?;

    Ok(sig)
}

// ==== Market: create (unsigned tx to be signed by user) ====

pub fn create_market(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    price_feed: Pubkey,
    market_type: onchain::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    // Derive all PDAs/ATAs needed by the instruction
    let (market_pda, _) = pda_market(&user_pubkey, &price_feed, end_ts);
    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let (config_pda, _) = pda_config();

    // Build instruction list for CreateMarket
    let ixs = program
        .request()
        .accounts(onchain::accounts::CreateMarket {
            authority: user_pubkey,
            price_feed,
            market: market_pda,
            mint,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            config: config_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::CreateMarket {
            market_type,
            comparator,
            bound_lo_usd_6,
            bound_hi_usd_6,
            end_ts,
        })
        .instructions()?;

    // Create unsigned tx (payer = user), return as base64
    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

// ==== Bet: create ====

pub fn build_place_bet_ixs(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
    feed_pubkey: Pubkey,
    side_yes: bool,
    amount_1e6: u64,
) -> Result<Vec<Instruction>> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, b"yes");
    let (escrow_no, _)  = pda_escrow_auth(&market_pda, b"no");
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no  = get_associated_token_address(&escrow_no,  &mint);
    let user_ata  = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

    let side = if side_yes { onchain::Side::Yes } else { onchain::Side::No };

    let ixs = program
        .request()
        .accounts(onchain::accounts::PlaceBet {
            user: user_pubkey,
            market: market_pda,
            feed: feed_pubkey,
            mint,
            user_ata,
            position: position_pda,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: anchor_client::solana_sdk::system_program::ID,
            rent: anchor_client::solana_sdk::sysvar::rent::ID,
        })
        .args(onchain::instruction::PlaceBet { side, amount: amount_1e6 })
        .instructions()?;

    Ok(ixs)
}

// ==== Market: create + optional seed in one transaction ====
pub fn build_create_and_seed(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    price_feed: Pubkey,
    market_type: onchain::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
    seed_side: onchain::Side, // Yes / No
    seed_amount: u64,         // 1e6 (USDC decimals)
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    // PDAs / ATAs
    let (market_pda, _) = pda_market(&user_pubkey, &price_feed, end_ts);
    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);
    let (config_pda, _) = pda_config();

    // CreateMarket
    let mut ixs = program
        .request()
        .accounts(onchain::accounts::CreateMarket {
            authority: user_pubkey,
            price_feed,
            market: market_pda,
            mint,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            config: config_pda,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::CreateMarket {
            market_type,
            comparator,
            bound_lo_usd_6,
            bound_hi_usd_6,
            end_ts,
        })
        .instructions()?; // first ix

    // Optional seeding via PlaceBet
    if seed_amount > 0 {
        let mut place_ixs = program
            .request()
            .accounts(onchain::accounts::PlaceBet {
                user: user_pubkey,
                market: market_pda,
                feed: price_feed,
                mint,
                user_ata,
                escrow_authority_yes: escrow_yes,
                escrow_authority_no: escrow_no,
                escrow_vault_yes: vault_yes,
                escrow_vault_no: vault_no,
                position: position_pda,
                token_program: TOKEN_PROGRAM_ID,
                associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
                rent: sysvar::rent::ID,
            })
            .args(onchain::instruction::PlaceBet {
                side: seed_side,
                amount: seed_amount,
            })
            .instructions()?; // second ix

        ixs.append(&mut place_ixs);
    }
    let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let memo_str = format!("solpredict:{ts}");
    ixs.push(build_memo(memo_str.as_bytes(), &[]));

    // Single unsigned transaction (payer = user)
    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

// ==== Market: resolve ====

pub fn build_resolve(
    ctx: &AnchorCtx,
    resolver_pubkey: Pubkey,
    market_authority: Pubkey,
    price_feed: Pubkey,
    end_ts: i64,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint: Pubkey = "5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh"
        .parse()
        .unwrap();

    let (market_pda, _) = pda_market(&market_authority, &price_feed, end_ts);
    let market_acc: onchain::Market = program.account(market_pda)?;
    let treasury_owner = market_acc.treasury_wallet_snapshot;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let resolver_ata = get_associated_token_address(&resolver_pubkey, &mint);
    let treasury_ata = get_associated_token_address(&treasury_owner, &mint);

    // Compose instruction list
    let mut ixs: Vec<Instruction> = Vec::new();

    // Ensure treasury ATA exists; create in the same tx if missing (payer = resolver)
    let need_treasury_ata = program
        .rpc()
        .get_account_with_commitment(&treasury_ata, CommitmentConfig::processed())?
        .value
        .is_none();

    if need_treasury_ata {
        ixs.push(ata_ix::create_associated_token_account(
            &resolver_pubkey,
            &treasury_owner,
            &mint,
            &TOKEN_PROGRAM_ID,
        ));
    }

    // ResolveMarket instruction
    let mut resolve_ixs = program
        .request()
        .accounts(onchain::accounts::ResolveMarket {
            market: market_pda,
            feed: price_feed,
            resolver: resolver_pubkey,
            resolver_ata,
            mint,
            treasury_ata,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::ResolveMarket {})
        .instructions()?;

    ixs.append(&mut resolve_ixs);

    // Unsigned tx (payer = resolver)
    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&resolver_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

// ==== Market: claim winnings ====

pub fn build_claim(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_authority: Pubkey,
    price_feed: Pubkey,
    end_ts: i64,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint: Pubkey = "5WVkLTcYYSKaYG7hFc69ysioBRGPxA4KgreQDQ7wJTMh"
        .parse()
        .unwrap();

    let (market_pda, _) = pda_market(&market_authority, &price_feed, end_ts);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);

    let ixs = program
        .request()
        .accounts(onchain::accounts::Claim {
            user: user_pubkey,
            market: market_pda,
            mint,
            user_ata,
            position: position_pda,
            escrow_authority_yes: escrow_yes,
            escrow_authority_no: escrow_no,
            escrow_vault_yes: vault_yes,
            escrow_vault_no: vault_no,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::Claim {})
        .instructions()?;

    // Unsigned tx (payer = user)
    let bh = latest_blockhash(&program)?;
    let mut tx = Transaction::new_with_payer(&ixs, Some(&user_pubkey));
    tx.message.recent_blockhash = bh;

    encode_unsigned_tx(&tx)
}

// ==== Config: init / update ====

pub fn init_config(
    ctx: &AnchorCtx,
    admin: &Keypair, // who invokes (admin)
    treasury_wallet: Pubkey,
    fee_bps: u16,
    resolver_bps: u16,
    resolver_tip_cap: u64,
) -> anyhow::Result<Signature> {
    let program = program(ctx)?;
    let (config_pda, _) = pda_config();
    let sig = program
        .request()
        .accounts(onchain::accounts::InitConfig {
            admin: admin.pubkey(),
            treasury_wallet,
            config: config_pda,
            system_program: system_program::ID,
        })
        .args(onchain::instruction::InitConfig {
            fee_bps,
            resolver_bps,
            resolver_tip_cap,
        })
        .signer(admin)
        .send()?;
    Ok(sig)
}

pub fn update_config(
    ctx: &AnchorCtx,
    admin: &Keypair,
    fee_bps: Option<u16>,
    resolver_bps: Option<u16>,
    resolver_tip_cap: Option<u64>,
    new_treasury: Option<Pubkey>,
) -> anyhow::Result<Signature> {
    let program = program(ctx)?;
    let (config_pda, _) = pda_config();
    let sig = program
        .request()
        .accounts(onchain::accounts::UpdateConfig {
            admin: admin.pubkey(),
            config: config_pda,
        })
        .args(onchain::instruction::UpdateConfig {
            fee_bps,
            resolver_bps,
            resolver_tip_cap,
            new_treasury,
        })
        .signer(admin)
        .send()?;
    Ok(sig)
}
