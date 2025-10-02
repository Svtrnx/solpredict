use serde::Serialize;

#[derive(Serialize)]
pub struct IxAccountMetaJson {
    pub pubkey: String,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(Serialize)]
pub struct IxJson {
    pub program_id: String,
    pub accounts: Vec<IxAccountMetaJson>,
    /// base64-encoded instruction data
    pub data_b64: String,
}

/// Set of instructions for resolve + service information
#[derive(Serialize)]
pub struct ResolveIxBundle {
    pub ok: bool,
    pub market_id: String,
    pub end_ts: i64,
    pub feed_id_hex: String,
    /// The price_update account index in the accounts array of the main ix `ResolveMarket`
    pub price_update_index: usize,
    /// Instructions in order of execution. May include create ATA for treasury
    pub instructions: Vec<IxJson>,
    pub message: String,
}
