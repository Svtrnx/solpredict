use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub server: Server,
    pub database: Database,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Server {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Database {
    pub url: String,
    pub max_connections: Option<u32>,
}

// Load settings from environment
pub fn load() -> anyhow::Result<Settings> {
    let _ = dotenvy::dotenv();

    // Read from ENV using APP__ prefix and double-underscore nesting
    let cfg = config::Config::builder()
        .add_source(config::Environment::with_prefix("APP").separator("__"))
        // defaults for server
        .set_default("server.host", "0.0.0.0")?
        .set_default("server.port", 6570)?
        // default DB pool size
        .set_default("database.max_connections", 50)?
        .build()?;

    // Deserialize
    Ok(cfg.try_deserialize()?)
}
