use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

/// Multiply and divide for u64: (a * b) / d
pub fn mul_div_u64(a: u64, b: u64, d: u64) -> Result<u64> {
    let num = (a as u128)
        .checked_mul(b as u128)
        .ok_or(error!(ErrorCode::Overflow))?;
    Ok((num / d as u128) as u64)
}

/// Calculate basis points: (x * bps) / 10000
pub fn mul_div_bps_u128(x: u128, bps: u128) -> Result<u128> {
    let num = x.checked_mul(bps).ok_or(error!(ErrorCode::Overflow))?;
    Ok(num / 10_000)
}

/// Convert Pyth price to USD with 6 decimals
pub fn price_to_usd_1e6_from_pyth(price: i64, exponent: i32) -> Result<i64> {
    let mut v = price as i128;
    let shift = exponent as i128 + 6;
    
    if shift >= 0 {
        v *= 10i128.pow(shift as u32);
    } else {
        v /= 10i128.pow((-shift) as u32);
    }
    
    if v > i64::MAX as i128 || v < i64::MIN as i128 {
        return Err(error!(ErrorCode::Overflow));
    }
    
    Ok(v as i64)
}

/// Compare two values based on comparator
/// 0 = GT, 1 = LT, 2 = GTE, 3 = LTE
pub fn cmp_check(comparator: u8, lhs: i64, rhs: i64) -> Result<bool> {
    Ok(match comparator {
        0 => lhs > rhs,
        1 => lhs < rhs,
        2 => lhs >= rhs,
        3 => lhs <= rhs,
        _ => return Err(error!(ErrorCode::BadComparator)),
    })
}