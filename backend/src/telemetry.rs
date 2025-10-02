use tracing_subscriber::{EnvFilter, fmt, prelude::*};
use tracing_error::ErrorLayer;

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info,tower_governor=info,sqlx=warn,solpredict=debug"));

    let fmt_layer = fmt::layer()
        .with_target(false)
        .with_line_number(true)
        .with_file(true);

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .with(ErrorLayer::default()) 
        .init();
}
