use base64::{engine::general_purpose::STANDARD as B64, Engine};
use sha2::{Digest, Sha256};
use serde_json::Value;

pub fn b58(s: &str) -> Option<Vec<u8>> { bs58::decode(s).into_vec().ok() }
pub fn b64(s: &str) -> Option<Vec<u8>> { B64.decode(s).ok() }

pub fn anchor_sighash(name: &str) -> [u8; 8] {
    let mut h = Sha256::new();
    h.update(format!("global:{name}"));
    let out = h.finalize();
    let mut d = [0u8; 8];
    d.copy_from_slice(&out[..8]);
    d
}

/// bytes from the data field (base58 or base64)
pub fn ix_data_bytes(ix: &Value) -> Option<Vec<u8>> {
    let s = ix.get("data")?.as_str()?;
    b58(s).or_else(|| b64(s))
}

/// Retrieves an array of instructions + `message.accountKeys` for indexes
pub fn extract_instructions<'a>(item: &'a Value) -> (Vec<&'a Value>, Option<&'a [Value]>) {
    if let Some(arr) = item.get("instructions").and_then(|v| v.as_array()) {
        return (arr.iter().collect(), None);
    }
    if let Some(arr) = item.pointer("/transaction/message/instructions").and_then(|v| v.as_array()) {
        let keys = item.pointer("/transaction/message/accountKeys").and_then(|v| v.as_array());
        return (arr.iter().collect(), keys.map(|k| k.as_slice()));
    }
    (Vec::new(), None)
}

/// `programId` can be a string or an index in `accountKeys`
pub fn ix_program_id<'a>(ix: &'a Value, msg_keys: Option<&'a [Value]>) -> Option<&'a str> {
    if let Some(pid) = ix.get("programId").and_then(|v| v.as_str()) {
        return Some(pid);
    }
    if let (Some(keys), Some(idx)) = (msg_keys, ix.get("programIdIndex").and_then(|v| v.as_u64())) {
        return keys.get(idx as usize).and_then(|k| k.as_str());
    }
    None
}

pub fn extract_sig(item: &Value) -> Option<&str> {
    item.get("signature").and_then(|v| v.as_str())
        .or_else(|| item.pointer("/txSignature").and_then(|v| v.as_str()))
        .or_else(|| item.pointer("/transactions/0/signature").and_then(|v| v.as_str()))
        .or_else(|| item.pointer("/transaction/signatures/0").and_then(|v| v.as_str()))
}
pub fn extract_slot(item: &Value) -> Option<i64> {
    item.get("slot").and_then(|v| v.as_i64())
        .or_else(|| item.pointer("/transactions/0/slot").and_then(|v| v.as_i64()))
}
pub fn extract_fee_payer(item: &Value) -> Option<&str> {
    item.get("feePayer").and_then(|v| v.as_str())
        .or_else(|| item.pointer("/transaction/message/accountKeys/0").and_then(|v| v.as_str()))
}

pub fn val_to_f64(v: &Value) -> Option<f64> {
    if let Some(n) = v.as_f64() { return Some(n); }
    if let Some(s) = v.as_str() { return s.parse::<f64>().ok(); }
    None
}

/// Memo from the list of instructions
pub fn extract_memo(ixs: &[&Value], msg_keys: Option<&[Value]>, memo_program: &str) -> Option<String> {
    for ix in ixs {
        if ix_program_id(ix, msg_keys) == Some(memo_program) {
            if let Some(bytes) = ix_data_bytes(ix) {
                if let Ok(s) = String::from_utf8(bytes) {
                    return Some(s);
                }
            }
        }
    }
    None
}

pub fn amount_user_from_token_transfers<'a>(item: &'a Value, mint: &str) -> Option<(f64, &'a str)> {
    let tt = item.get("tokenTransfers")?.as_array()?;
    for t in tt {
        if t.get("mint").and_then(|v| v.as_str()) != Some(mint) { continue; }
        let amt = t.get("tokenAmount").and_then(val_to_f64).unwrap_or(0.0);
        if amt <= 0.0 { continue; }
        let from = t.get("fromUserAccount").and_then(|v| v.as_str()).unwrap_or("");
        return Some((amt, from));
    }
    None
}

pub fn amount_from_meta_delta(item: &Value, account_index: usize, mint: &str) -> Option<f64> {
    let pre = item.pointer("/meta/preTokenBalances")?.as_array()?;
    let post = item.pointer("/meta/postTokenBalances")?.as_array()?;

    let mut pre_ui: Option<f64> = None;
    let mut post_ui: Option<f64> = None;

    for p in pre {
        if p.get("accountIndex")?.as_u64()? as usize != account_index { continue; }
        if p.get("mint")?.as_str()? != mint { continue; }
        if let Some(ui) = p.pointer("/uiTokenAmount/uiAmount").and_then(val_to_f64) {
            pre_ui = Some(ui);
        } else if let (Some(amount), Some(dec)) = (
            p.pointer("/uiTokenAmount/amount").and_then(|v| v.as_str()),
            p.pointer("/uiTokenAmount/decimals").and_then(|v| v.as_u64()),
        ) {
            if let Ok(raw) = amount.parse::<f64>() {
                pre_ui = Some(raw / 10f64.powi(dec as i32));
            }
        }
    }

    for q in post {
        if q.get("accountIndex")?.as_u64()? as usize != account_index { continue; }
        if q.get("mint")?.as_str()? != mint { continue; }
        if let Some(ui) = q.pointer("/uiTokenAmount/uiAmount").and_then(val_to_f64) {
            post_ui = Some(ui);
        } else if let (Some(amount), Some(dec)) = (
            q.pointer("/uiTokenAmount/amount").and_then(|v| v.as_str()),
            q.pointer("/uiTokenAmount/decimals").and_then(|v| v.as_u64()),
        ) {
            if let Ok(raw) = amount.parse::<f64>() {
                post_ui = Some(raw / 10f64.powi(dec as i32));
            }
        }
    }

    match (pre_ui, post_ui) {
        (Some(a), Some(b)) if a > b => Some(a - b),
        _ => None,
    }
}

/// Retrieves accounts both as strings and as indexes
pub fn accounts_str_and_idx<'a>(ix: &'a Value, msg_keys: Option<&'a [Value]>) -> (Vec<&'a str>, Vec<usize>) {
    let mut acc_str: Vec<&str> = Vec::new();
    let mut acc_idx: Vec<usize> = Vec::new();

    if let Some(accs) = ix.get("accounts").and_then(|v| v.as_array()) {
        if accs.iter().all(|a| a.is_string()) {
            if let Some(keys) = msg_keys {
                acc_str = accs.iter().filter_map(|a| a.as_str()).collect();
                let keys_vec: Vec<&str> = keys.iter().filter_map(|k| k.as_str()).collect();
                acc_idx = acc_str.iter().map(|s| {
                    keys_vec.iter().position(|k| *k == *s).unwrap_or(usize::MAX)
                }).collect();
            } else {
                acc_str = accs.iter().filter_map(|a| a.as_str()).collect();
            }
        } else {
            acc_idx = accs.iter().filter_map(|a| a.as_u64().map(|u| u as usize)).collect();
            if let Some(keys) = msg_keys {
                let keys_vec: Vec<&str> = keys.iter().filter_map(|k| k.as_str()).collect();
                acc_str = acc_idx.iter().map(|&i| keys_vec.get(i).copied().unwrap_or("<unknown>")).collect();
            }
        }
    }
    (acc_str, acc_idx)
}
