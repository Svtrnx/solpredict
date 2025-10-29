mod context;
mod pda;
mod encoding;
mod market;
mod betting;
mod resolution;
mod admin;
mod accounts;
mod attestation;
mod transactions;

// Re-export main types and functions
pub use context::{AnchorCtx, connect_devnet, program};
pub use market::{
    create_market, 
    build_create_and_seed,
    build_create_market_ai_binary_unsigned,
};
pub use accounts::{
    get_market_account,
    fetch_market_account,
    fetch_market_snapshot,
    snapshot_from_market,
    MarketSnapshot,
    get_position_account,
    get_position_multi_account,
};
pub use betting::{
    build_place_bet_ixs,
    build_place_bet_multi_ixs,
    build_place_bet_multi_unsigned,
};
pub use resolution::{
    build_resolve,
    build_resolve_ix_bundle,
    build_claim_ix,
    ai_propose_prepare,
    finalize_ai_unsigned,
};
pub use admin::{
    init_config,
    update_config,
    airdrop_usdc_once,
    set_token_metadata,
};
pub use encoding::{
    encode_unsigned_tx,
    parse_pubkey,
};
pub use transactions::{
    wait_for_confirmation,
};