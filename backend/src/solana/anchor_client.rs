use anchor_client::solana_client::nonblocking::rpc_client::RpcClient;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::anchor_lang::InstructionData;
use anchor_client::solana_sdk::sysvar;
use anchor_client::solana_sdk::{
    signature::{Signature, read_keypair_file},
    instruction::{AccountMeta, Instruction},
    signer::{Signer, keypair::Keypair},
    transaction::Transaction,
    pubkey::Pubkey,
    system_program,
    hash::Hash,
};

use spl_associated_token_account::instruction as ata_ix;
use anchor_spl::{
    token::{
        self, ID as TOKEN_PROGRAM_ID
    },
    associated_token::{
        self, ID as ASSOCIATED_TOKEN_PROGRAM_ID, get_associated_token_address
    },
};

use bincode::{config::standard, serde::encode_to_vec};
use anchor_client::{Client, Cluster, Program};
use base64::{Engine, engine::general_purpose};
use std::time::{SystemTime, UNIX_EPOCH};
use std::{str::FromStr, time::Duration};
use anyhow::{Context, Result};
use spl_memo::build_memo;
use tokio::time::sleep;
use std::sync::Arc;

use crate::{types::ix::{IxAccountMetaJson, IxJson, ResolveIxBundle}, state};
use prediction_market_program as onchain;

pub struct AnchorCtx {
    pub client: Client<Arc<Keypair>>,
    pub payer: Arc<Keypair>,
    pub program_id: Pubkey,
}

const SIDE_YES: &[u8] = b"yes";
const SIDE_NO: &[u8] = b"no";

// ==== PDA helpers ====

fn pda_market(user: &Pubkey, feed: &[u8; 32], end_ts: i64) -> (Pubkey, u8) {
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

// ─────────────────────────────────────────────────────────────
// Thin helpers: PDAs & account fetch
// ─────────────────────────────────────────────────────────────

pub fn get_market_account(ctx: &AnchorCtx, market_pda: Pubkey) -> anyhow::Result<onchain::Market> {
    let program = program(ctx)?;
    let acc: onchain::Market = program
        .account(market_pda)
        .map_err(|e| anyhow::anyhow!("market account fetch failed: {e}"))?;
    Ok(acc)
}

pub async fn fetch_market_account(
    ctx: Arc<AnchorCtx>,
    market_pda: Pubkey,
) -> anyhow::Result<onchain::Market> {
    tokio::task::spawn_blocking(move || get_market_account(ctx.as_ref(), market_pda))
        .await
        .map_err(|e| anyhow::anyhow!("join error: {e}"))?
}

#[derive(Debug, Clone)]
pub struct MarketSnapshot {
    pub settled: bool,
    pub winning_side: Option<i16>,      // 1=YES, 2=NO, 3=VOID
    pub resolved_price_1e6: Option<i64>,
    pub payout_pool_1e6: Option<i64>,
}

pub fn snapshot_from_market(m: &onchain::Market) -> MarketSnapshot {
    let winning_side: Option<i16> = if m.settled {
        match m.winning_side {
            1 => Some(1), // YES
            2 => Some(2), // NO
            3 => Some(3), // VOID
            _ => None,
        }
    } else { None };

    let resolved_price_1e6 = if m.resolved_price_1e6 == 0 { None } else { Some(m.resolved_price_1e6) };
    let payout_pool_1e6    = Some(m.payout_pool as i64);

    MarketSnapshot { settled: m.settled, winning_side, resolved_price_1e6, payout_pool_1e6 }
}

pub async fn fetch_market_snapshot(
    ctx: std::sync::Arc<AnchorCtx>,
    market_pda: Pubkey,
) -> anyhow::Result<MarketSnapshot> {
    let m = fetch_market_account(ctx, market_pda).await?;
    Ok(snapshot_from_market(&m))
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
    let state = state::global();
    let program = program(ctx)?;
    let mint = Pubkey::from_str(&state.usdc_mint)?;

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
    let state = state::global();
    let program = program(ctx)?;
    let mint = Pubkey::from_str(&state.usdc_mint)?;
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
    feed_id: [u8; 32],
    market_type: onchain::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    // Derive all PDAs/ATAs needed by the instruction
    let (market_pda, _) = pda_market(&user_pubkey, &feed_id, end_ts);
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
            feed_id,
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
    side_yes: bool,
    amount_1e6: u64,
) -> Result<Vec<Instruction>> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, b"yes");
    let (escrow_no, _) = pda_escrow_auth(&market_pda, b"no");
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

    let side = if side_yes {
        onchain::Side::Yes
    } else {
        onchain::Side::No
    };

    let ixs = program
        .request()
        .accounts(onchain::accounts::PlaceBet {
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
            system_program: anchor_client::solana_sdk::system_program::ID,
            rent: anchor_client::solana_sdk::sysvar::rent::ID,
        })
        .args(onchain::instruction::PlaceBet {
            side,
            amount: amount_1e6,
        })
        .instructions()?;

    Ok(ixs)
}

// ==== Market: create + optional seed in one transaction ====
pub fn build_create_and_seed(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    feed_id: [u8; 32],
    market_type: onchain::MarketType,
    comparator: u8,
    bound_lo_usd_6: i64,
    bound_hi_usd_6: i64,
    end_ts: i64,
    seed_side: onchain::Side, // Yes / No
    seed_amount: u64,         // 1e6 (USDC decimals)
    memo_opt: Option<&[u8]>,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    // PDAs / ATAs
    let (market_pda, _) = pda_market(&user_pubkey, &feed_id, end_ts);
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
            feed_id,
        })
        .instructions()?; // first ix

    // Optional seeding via PlaceBet
    if seed_amount > 0 {
        let mut place_ixs = program
            .request()
            .accounts(onchain::accounts::PlaceBet {
                user: user_pubkey,
                market: market_pda,
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

    if let Some(memo_bytes) = memo_opt {
        ixs.push(build_memo(memo_bytes, &[]));
    }

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
    feed_id: [u8; 32],
    end_ts: i64,
    price_update: Pubkey,
) -> anyhow::Result<String> {
    let state = state::global();
    let program = program(ctx)?;
    let mint = Pubkey::from_str(&state.usdc_mint)?;

    let (market_pda, _) = pda_market(&market_authority, &feed_id, end_ts);
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
            price_update,
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

fn ix_to_json(ix: Instruction) -> IxJson {
    IxJson {
        program_id: ix.program_id.to_string(),
        accounts: ix
            .accounts
            .into_iter()
            .map(|m| IxAccountMetaJson {
                pubkey: m.pubkey.to_string(),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data_b64: general_purpose::STANDARD.encode(ix.data),
    }
}

pub fn build_resolve_ix_bundle(
    ctx: &AnchorCtx,
    resolver_pubkey: Pubkey,
    market_pda: Pubkey,
) -> Result<ResolveIxBundle> {
    let program = program(ctx)?;
    let mint: Pubkey = onchain::USDC_MINT;
    // read market account
    let market_acc: onchain::Market = program.account(market_pda)?;
    if market_acc.settled {
        anyhow::bail!("market already settled");
    }

    // feed_id hex
    let feed_id_hex = format!("0x{}", hex::encode(market_acc.feed_id));

    let end_ts = market_acc.end_ts;

    let treasury_owner = market_acc.treasury_wallet_snapshot;
    // derive PDAs/ATAs
    let (escrow_yes, _) =
        Pubkey::find_program_address(&[b"escrow-auth", market_pda.as_ref(), b"yes"], &onchain::ID);
    let (escrow_no, _) =
        Pubkey::find_program_address(&[b"escrow-auth", market_pda.as_ref(), b"no"], &onchain::ID);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let resolver_ata = get_associated_token_address(&resolver_pubkey, &mint);
    let treasury_ata = get_associated_token_address(&treasury_owner, &mint);
    // instructions in JSON
    let mut out: Vec<IxJson> = vec![];

    // create ATA for treasure (payer = resolver)
    let need_treasury_ata = program
        .rpc()
        .get_account_with_commitment(&treasury_ata, CommitmentConfig::processed())?
        .value
        .is_none();
    if need_treasury_ata {
        let create_ata_ix = ata_ix::create_associated_token_account(
            &resolver_pubkey,
            &treasury_owner,
            &mint,
            &anchor_spl::token::ID,
        );
        out.push(ix_to_json(create_ata_ix));
    }
    // initial ix ResolveMarket
    let price_update_placeholder = Pubkey::default();

    let accounts = vec![
        AccountMeta::new(market_pda, false),
        AccountMeta::new_readonly(price_update_placeholder, false),
        AccountMeta::new(resolver_pubkey, true),
        AccountMeta::new(resolver_ata, false), 
        AccountMeta::new_readonly(mint, false),
        AccountMeta::new(treasury_ata, false),
        AccountMeta::new_readonly(escrow_yes, false),
        AccountMeta::new_readonly(escrow_no, false),
        AccountMeta::new(vault_yes, false),
        AccountMeta::new(vault_no, false),
        AccountMeta::new_readonly(anchor_spl::token::ID, false), 
        AccountMeta::new_readonly(anchor_spl::associated_token::ID, false),
        AccountMeta::new_readonly(anchor_client::solana_sdk::system_program::ID, false),
    ];
    // discriminator + empty data
    let data = onchain::instruction::ResolveMarket {}.data();

    let resolve_ix = Instruction {
        program_id: onchain::ID,
        accounts,
        data,
    };
    // in JSON
    out.push(ix_to_json(resolve_ix));

    Ok(ResolveIxBundle {
        ok: true,
        market_id: market_pda.to_string(),
        end_ts,
        feed_id_hex,
        price_update_index: 1,
        instructions: out,
        message: "Resolve ix bundle; inject price_update and send with Pyth Receiver".into(),
    })
}

// ==== Market: claim winnings ====
pub fn build_claim(
    ctx: &AnchorCtx,
    user_pubkey: Pubkey,
    market_pda: Pubkey,
) -> anyhow::Result<String> {
    let program = program(ctx)?;
    let mint = onchain::USDC_MINT;

    let (escrow_yes, _) = pda_escrow_auth(&market_pda, SIDE_YES);
    let (escrow_no, _) = pda_escrow_auth(&market_pda, SIDE_NO);
    let vault_yes = get_associated_token_address(&escrow_yes, &mint);
    let vault_no = get_associated_token_address(&escrow_no, &mint);
    let user_ata = get_associated_token_address(&user_pubkey, &mint);
    let (position_pda, _) = pda_position(&market_pda, &user_pubkey);

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
