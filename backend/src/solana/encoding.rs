use anchor_client::solana_sdk::{
    transaction::Transaction,
    pubkey::Pubkey,
};
use anyhow::{Context, Result};
use base64::{Engine, engine::general_purpose};
use bincode::{config::standard, serde::encode_to_vec};
use std::str::FromStr;

/// Encode unsigned transaction to base64 string for client signing
pub fn encode_unsigned_tx(tx: &Transaction) -> Result<String> {
    let bytes = encode_to_vec(tx, standard())
        .map_err(|e| anyhow::anyhow!("bincode encode failed: {e}"))?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

/// Parse Pubkey from string with better error message
pub fn parse_pubkey(s: &str) -> Result<Pubkey> {
    Pubkey::from_str(s).context("invalid pubkey string")
}

/// Decode oracle pubkey from various formats (base58, hex, base64)
pub fn decode_oracle_pubkey_32(s: &str) -> Result<[u8; 32]> {
    // Try base58
    if let Ok(v) = bs58::decode(s).into_vec() {
        if v.len() == 32 {
            return Ok(v.as_slice().try_into().unwrap());
        }
    }
    
    // Try hex
    if let Ok(v) = hex::FromHex::from_hex(s) {
        return Ok(v);
    }
    
    // Try base64
    if let Ok(v) = general_purpose::STANDARD.decode(s) {
        if v.len() == 32 {
            return Ok(v.as_slice().try_into().unwrap());
        }
    }
    
    anyhow::bail!("AI_ORACLE_PUBKEY must be 32 bytes (b58/hex/base64)")
}

/// Decode oracle secret key from various formats
pub fn decode_oracle_secret_32(s: &str) -> Result<[u8; 32]> {
    // Try hex
    if let Ok(v) = hex::FromHex::from_hex(s) {
        return Ok(v);
    }
    
    // Try base64
    if let Ok(v) = general_purpose::STANDARD.decode(s) {
        if v.len() == 32 {
            return Ok(v.as_slice().try_into().unwrap());
        }
    }
    
    // Try base58
    if let Ok(v) = bs58::decode(s).into_vec() {
        if v.len() == 32 {
            return Ok(v.as_slice().try_into().unwrap());
        }
    }
    
    anyhow::bail!("AI_ORACLE_SECRET must be 32-byte seed (hex/base64/b58)")
}
