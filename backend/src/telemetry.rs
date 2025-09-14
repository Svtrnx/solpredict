use tracing_subscriber::{EnvFilter, fmt};

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info,tower_governor=info"));
    fmt().with_env_filter(filter).init();
}
