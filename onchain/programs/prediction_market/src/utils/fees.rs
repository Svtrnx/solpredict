use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::math::mul_div_bps_u128;

#[derive(Debug, Clone, Copy)]
pub struct FeeBreakdown {
    pub protocol_fee: u128,
    pub resolver_tip: u128,
    pub creator_tip: u128,
    pub total_deductions: u128,
}

impl FeeBreakdown {
    pub fn calculate(
        pot: u128,
        fee_bps: u16,
        resolver_bps: u16,
        creator_bps: u16,
    ) -> Result<Self> {
        let protocol_fee = mul_div_bps_u128(pot, fee_bps as u128)?;
        let resolver_tip = mul_div_bps_u128(pot, resolver_bps as u128)?;
        let creator_tip = mul_div_bps_u128(pot, creator_bps as u128)?;
        
        let total_deductions = protocol_fee
            .checked_add(resolver_tip)
            .ok_or(error!(ErrorCode::Overflow))?
            .checked_add(creator_tip)
            .ok_or(error!(ErrorCode::Overflow))?;
        
        Ok(Self {
            protocol_fee,
            resolver_tip,
            creator_tip,
            total_deductions,
        })
    }
    
    pub fn to_u64_parts(&self) -> Result<(u64, u64, u64)> {
        let fee_u64 = self.protocol_fee
            .try_into()
            .map_err(|_| error!(ErrorCode::Overflow))?;
        let resolver_u64 = self.resolver_tip
            .try_into()
            .map_err(|_| error!(ErrorCode::Overflow))?;
        let creator_u64 = self.creator_tip
            .try_into()
            .map_err(|_| error!(ErrorCode::Overflow))?;
        Ok((fee_u64, resolver_u64, creator_u64))
    }
}