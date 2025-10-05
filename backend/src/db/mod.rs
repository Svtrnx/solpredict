use sqlx::{postgres::PgPoolOptions, PgPool};

#[derive(Clone)]
pub struct Db(PgPool);
impl Db { pub fn pool(&self) -> &PgPool { &self.0 } }

pub async fn init_pool(database_url: &str) -> anyhow::Result<Db> {
    let pool = PgPoolOptions::new()
        .max_connections(std::env::var("APP__DATABASE__MAX_CONNECTIONS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(50)
        )
        .after_connect(|conn, _| Box::pin(async move {
            sqlx::query("SET TIME ZONE 'UTC'").execute(conn).await?;
            Ok(())
        }))
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(Db(pool))
}
