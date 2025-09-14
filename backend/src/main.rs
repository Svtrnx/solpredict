use solpredict::config;
use solpredict::db;
use solpredict::routes;
use solpredict::solana::anchor_client;
use solpredict::state;
use solpredict::telemetry;

use std::sync::Arc;
use std::{env, net::SocketAddr};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Init logging
    telemetry::init();

    // Load config
    let settings = config::load()?;

    let db = db::init_pool(&settings.database.url).await?;

    // Connect Anchor client (Solana devnet)
    let anchor = anchor_client::connect_devnet()?;

    // SIWS
    let siws_domain = env::var("SIWS_DOMAIN").unwrap_or_else(|_| "localhost:3000".into());
    let siws_uri = env::var("SIWS_URI").unwrap_or_else(|_| format!("http://{}", siws_domain));

    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());

    // Application state (shared across handlers)
    let app_state = state::AppState::new(
        siws_domain.clone(),
        siws_uri.clone(),
        jwt_secret,
        db,
        Arc::new(anchor),
    );

    let app = routes::build(app_state);

    // Start HTTP server
    let addr = SocketAddr::new(settings.server.host.parse()?, settings.server.port);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("🚀 API listening on http://{}", addr);
    tracing::info!(
        "🔐 SIWS expects domain='{}', uri='{}'",
        siws_domain,
        siws_uri
    );

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
