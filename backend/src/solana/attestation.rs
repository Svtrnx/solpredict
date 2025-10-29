use anchor_client::solana_sdk::{
    pubkey::Pubkey,
    instruction::Instruction,
    ed25519_instruction::new_ed25519_instruction_with_signature,
};
use ed25519_dalek::{SigningKey, Signer as DalekSigner};

/// Domain separator for attestations
const DOMAIN: &[u8] = b"SOLPREDICT_ATTESTATION_v1";

/// Build attestation message for single winner
#[inline]
pub fn build_message_single_client(
    market: &Pubkey,
    outcome_idx: u8,
    end_ts: i64,
    attest_ts: i64,
    nonce: u64,
    program_id: &Pubkey,
) -> Vec<u8> {
    let mut v = Vec::with_capacity(DOMAIN.len() + 32 + 1 + 8 + 8 + 8 + 32);
    v.extend_from_slice(DOMAIN);
    v.extend_from_slice(market.as_ref());
    v.push(outcome_idx);
    v.extend_from_slice(&end_ts.to_le_bytes());
    v.extend_from_slice(&attest_ts.to_le_bytes());
    v.extend_from_slice(&nonce.to_le_bytes());
    v.extend_from_slice(program_id.as_ref());
    v
}

/// Build attestation message for multiple winners (not implemented yet)
#[inline]
pub fn build_message_multi_client(
    market: &Pubkey,
    mut winners: Vec<u8>,
    end_ts: i64,
    attest_ts: i64,
    nonce: u64,
    program_id: &Pubkey,
) -> Vec<u8> {
    winners.sort_unstable();
    winners.dedup();
    
    let mut v = Vec::with_capacity(DOMAIN.len() + 32 + 1 + winners.len() + 8 + 8 + 8 + 32);
    v.extend_from_slice(DOMAIN);
    v.extend_from_slice(market.as_ref());
    v.push(winners.len() as u8);
    v.extend_from_slice(&winners);
    v.extend_from_slice(&end_ts.to_le_bytes());
    v.extend_from_slice(&attest_ts.to_le_bytes());
    v.extend_from_slice(&nonce.to_le_bytes());
    v.extend_from_slice(program_id.as_ref());
    v
}

/// Create Ed25519 instruction from secret key
#[inline]
pub fn make_ed25519_ix_from_secret(
    oracle_secret: &[u8; 32],
    oracle_pubkey: [u8; 32],
    message: &[u8],
) -> Instruction {
    let sk = SigningKey::from_bytes(oracle_secret);
    
    // Verify pubkey matches secret
    assert_eq!(
        sk.verifying_key().to_bytes(),
        oracle_pubkey,
        "oracle pubkey doesn't match secret"
    );

    let sig = sk.sign(message).to_bytes();
    new_ed25519_instruction_with_signature(message, &sig, &oracle_pubkey)
}
