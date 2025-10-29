use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::{constants::DOMAIN, errors::ErrorCode};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AttestationSingle {
    pub market: Pubkey,
    pub outcome_idx: u8,
    pub end_ts: i64,
    pub attest_ts: i64,
    pub nonce: u64,
    pub program: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AttestationMultiWinners {
    pub market: Pubkey,
    pub winners: Vec<u8>,
    pub end_ts: i64,
    pub attest_ts: i64,
    pub nonce: u64,
    pub program: Pubkey,
}

pub enum ParsedMode {
    Single {
        outcome_idx: u8,
        end_ts: i64,
        attest_ts: i64,
        nonce: u64,
        program: Pubkey,
        market: Pubkey,
    },
    Multi {
        winners: Vec<u8>,
        end_ts: i64,
        attest_ts: i64,
        nonce: u64,
        program: Pubkey,
        market: Pubkey,
    },
}

pub fn build_message_single(a: &AttestationSingle) -> Vec<u8> {
    let mut v = Vec::with_capacity(DOMAIN.len() + 32 + 1 + 8 + 8 + 8 + 32);
    v.extend_from_slice(DOMAIN);
    v.extend_from_slice(a.market.as_ref());
    v.push(a.outcome_idx);
    v.extend_from_slice(&a.end_ts.to_le_bytes());
    v.extend_from_slice(&a.attest_ts.to_le_bytes());
    v.extend_from_slice(&a.nonce.to_le_bytes());
    v.extend_from_slice(a.program.as_ref());
    v
}

pub fn build_message_multi(a: &AttestationMultiWinners) -> Vec<u8> {
    let mut winners = a.winners.clone();
    winners.sort_unstable();
    winners.dedup();
    
    let mut v = Vec::with_capacity(DOMAIN.len() + 32 + 1 + winners.len() + 8 + 8 + 8 + 32);
    v.extend_from_slice(DOMAIN);
    v.extend_from_slice(a.market.as_ref());
    v.push(winners.len() as u8);
    v.extend_from_slice(&winners);
    v.extend_from_slice(&a.end_ts.to_le_bytes());
    v.extend_from_slice(&a.attest_ts.to_le_bytes());
    v.extend_from_slice(&a.nonce.to_le_bytes());
    v.extend_from_slice(a.program.as_ref());
    v
}

pub fn parse_attestation_message(msg: &[u8]) -> Result<ParsedMode> {
    let mut i = 0usize;
    require!(
        msg.len() >= DOMAIN.len() + 32 + 1 + 8 + 8 + 8 + 32,
        ErrorCode::Unauthorized
    );
    require!(&msg[0..DOMAIN.len()] == DOMAIN, ErrorCode::Unauthorized);
    i += DOMAIN.len();

    let mut mkey = [0u8; 32];
    mkey.copy_from_slice(&msg[i..i + 32]);
    i += 32;
    let market = Pubkey::new_from_array(mkey);

    let first = msg[i];
    i += 1;
    let tail = 8 + 8 + 8 + 32;

    // Single winner: exactly tail bytes remain
    if msg.len() == i + tail {
        let end_ts = read_le_i64(msg, &mut i)?;
        let attest_ts = read_le_i64(msg, &mut i)?;
        let nonce = read_le_u64(msg, &mut i)?;
        require!(i + 32 <= msg.len(), ErrorCode::Unauthorized);
        
        let mut p = [0u8; 32];
        p.copy_from_slice(&msg[i..i + 32]);
        i += 32;
        let program = Pubkey::new_from_array(p);
        let outcome_idx = first;
        
        return Ok(ParsedMode::Single {
            outcome_idx,
            end_ts,
            attest_ts,
            nonce,
            program,
            market,
        });
    }

    // Multi winner: length = winners_len + tail
    let winners_len = first as usize;
    require!(msg.len() == i + winners_len + tail, ErrorCode::Unauthorized);
    require!(winners_len > 0, ErrorCode::BadMarketType);

    let mut winners = Vec::with_capacity(winners_len);
    winners.extend_from_slice(&msg[i..i + winners_len]);
    i += winners_len;
    
    let end_ts = read_le_i64(msg, &mut i)?;
    let attest_ts = read_le_i64(msg, &mut i)?;
    let nonce = read_le_u64(msg, &mut i)?;
    require!(i + 32 <= msg.len(), ErrorCode::Unauthorized);
    
    let mut p = [0u8; 32];
    p.copy_from_slice(&msg[i..i + 32]);
    i += 32;
    let program = Pubkey::new_from_array(p);

    Ok(ParsedMode::Multi {
        winners,
        end_ts,
        attest_ts,
        nonce,
        program,
        market,
    })
}

#[inline]
fn read_le_i64(input: &[u8], at: &mut usize) -> Result<i64> {
    require!(*at + 8 <= input.len(), ErrorCode::Unauthorized);
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&input[*at..*at + 8]);
    *at += 8;
    Ok(i64::from_le_bytes(buf))
}

#[inline]
fn read_le_u64(input: &[u8], at: &mut usize) -> Result<u64> {
    require!(*at + 8 <= input.len(), ErrorCode::Unauthorized);
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&input[*at..*at + 8]);
    *at += 8;
    Ok(u64::from_le_bytes(buf))
}

/// Parse Ed25519 instruction data
pub fn parse_ed25519<'a>(data: &'a [u8]) -> core::result::Result<(&'a [u8], &'a [u8]), ProgramError> {
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Ed25519Offsets {
        signature_offset: u16,
        signature_instruction_index: u16,
        pubkey_offset: u16,
        pubkey_instruction_index: u16,
        msg_offset: u16,
        msg_len: u16,
        msg_instruction_index: u16,
    }

    if data.len() < 2 + core::mem::size_of::<Ed25519Offsets>() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if data[0] != 1 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let rd = |d: &[u8], o: &mut usize| -> core::result::Result<u16, ProgramError> {
        if *o + 2 > d.len() {
            return Err(ProgramError::InvalidInstructionData);
        }
        let v = u16::from_le_bytes([d[*o], d[*o + 1]]);
        *o += 2;
        Ok(v)
    };

    let mut i = 2;
    let _sig_off = rd(data, &mut i)?;
    let sig_ix = rd(data, &mut i)?;
    let pk_off = rd(data, &mut i)?;
    let pk_ix = rd(data, &mut i)?;
    let msg_off = rd(data, &mut i)?;
    let msg_len = rd(data, &mut i)?;
    let msg_ix = rd(data, &mut i)?;

    if sig_ix != u16::MAX || pk_ix != u16::MAX || msg_ix != u16::MAX {
        return Err(ProgramError::InvalidInstructionData);
    }
    if (pk_off as usize) + 32 > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if (msg_off as usize) + (msg_len as usize) > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let pubkey = &data[pk_off as usize..pk_off as usize + 32];
    let message = &data[msg_off as usize..msg_off as usize + msg_len as usize];
    
    Ok((pubkey, message))
}