use sqlx::{PgPool, postgres::PgPoolOptions};
use anyhow::{Context, Result};

#[derive(Clone)]
pub struct Db(PgPool);
impl Db {
    pub fn pool(&self) -> &PgPool {
        &self.0
    }
}

pub async fn init_pool(database_url: &str) -> Result<Db> {
    let pool = PgPoolOptions::new()
        .max_connections(
            std::env::var("APP__DATABASE__MAX_CONNECTIONS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
        )
        .after_connect(|conn, _| {
            Box::pin(async move {
                sqlx::query("SET TIME ZONE 'UTC'").execute(conn).await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(Db(pool))
}

pub async fn init_redis_from_url(url: &str) -> Result<redis::Client> {
    let client = redis::Client::open(url)
        .with_context(|| format!("Failed to open Redis URL: {url}"))?;

    {
        let mut conn = client
            .get_multiplexed_async_connection()
            .await
            .context("Failed to establish initial Redis connection (multiplexed)")?;

        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .context("Redis PING failed")?;
    }

    Ok(client)
}
