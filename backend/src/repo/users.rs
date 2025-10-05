use sqlx::{FromRow, Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct WalletRow {
    pub id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub created_wallet: bool,
}

pub async fn upsert_wallet(
    pool: &sqlx::PgPool,
    wallet: &str,
    now: OffsetDateTime,
) -> anyhow::Result<(Uuid, Uuid, bool)> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    if let Some(rec) = sqlx::query_as::<_, WalletRow>(
        r#"
        UPDATE wallets
           SET last_login_at = $2,
               login_count   = login_count + 1
         WHERE wallet_address = $1
         RETURNING id, user_id, false AS created_wallet
        "#
    )
    .bind(wallet)
    .bind(now)
    .fetch_optional(&mut *tx)
    .await?
    {
        tx.commit().await?;
        return Ok((rec.user_id, rec.id, false));
    }

    let new_user_id: Uuid = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users DEFAULT VALUES RETURNING id"
    )
    .fetch_one(&mut *tx)
    .await?;

    let rec = sqlx::query_as::<_, WalletRow>(
        r#"
        INSERT INTO wallets (user_id, wallet_address, last_login_at, login_count)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (wallet_address) DO UPDATE
          SET last_login_at = EXCLUDED.last_login_at,
              login_count   = wallets.login_count + 1
        RETURNING id, user_id, (xmax = 0) AS created_wallet
        "#
    )
    .bind(new_user_id)
    .bind(wallet)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    if !rec.created_wallet {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(new_user_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok((rec.user_id, rec.id, rec.created_wallet))
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
