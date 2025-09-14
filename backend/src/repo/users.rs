use sqlx::{FromRow, Postgres, Transaction};
use time::OffsetDateTime;

#[derive(Debug, FromRow)]
pub struct WalletRow {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
}

pub async fn upsert_wallet(
    pool: &sqlx::PgPool,
    wallet: &str,
    now: OffsetDateTime,
) -> anyhow::Result<(uuid::Uuid, uuid::Uuid)> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    // Get wallet
    if let Some(rec) =
        sqlx::query_as::<_, WalletRow>("SELECT id, user_id FROM wallets WHERE wallet_address = $1")
            .bind(wallet)
            .fetch_optional(&mut *tx)
            .await?
    {
        // Update last_login/login_count and return
        let rec = sqlx::query_as::<_, WalletRow>(
            r#"
            UPDATE wallets
               SET last_login_at = $2,
                   login_count   = login_count + 1
             WHERE id = $1
             RETURNING id, user_id
            "#,
        )
        .bind(rec.id)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        return Ok((rec.user_id, rec.id));
    }

    // No wallet — create user
    let user_id =
        sqlx::query_scalar::<_, uuid::Uuid>("INSERT INTO users DEFAULT VALUES RETURNING id")
            .fetch_one(&mut *tx)
            .await?;

    // Create wallet
    let rec = sqlx::query_as::<_, WalletRow>(
        r#"
        INSERT INTO wallets (user_id, wallet_address, last_login_at, login_count)
        VALUES ($1, $2, $3, 1)
        RETURNING id, user_id
        "#,
    )
    .bind(user_id)
    .bind(wallet)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((rec.user_id, rec.id))
}

pub async fn exists_user_wallet(
    pool: &sqlx::PgPool,
    user_id: &str,
    wallet_id: &str,
    address: &str,
) -> sqlx::Result<bool> {
    let row: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM wallets w
          JOIN users u ON u.id = w.user_id
          WHERE u.id = $1::uuid
            AND w.id = $2::uuid
            AND w.wallet_address = $3
        )
        "#,
    )
    .bind(user_id)
    .bind(wallet_id)
    .bind(address)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
