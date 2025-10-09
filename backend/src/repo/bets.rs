use sqlx::{PgPool, Transaction, Postgres};
use time::OffsetDateTime;
use serde::Serialize;
use anyhow::Result;
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentBet {
    pub user_address: String,
    pub side: String,
    pub amount: f64,
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
    pub cursor_id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentBetsPage {
    pub items: Vec<RecentBet>,
    pub next_cursor: Option<i64>,
}

pub async fn mark_position_claimed_by_pda(
    pool: &PgPool,
    market_pda: &str,
    user_pubkey: &str,
    tx_sig_claim: &str,
) -> anyhow::Result<()> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let market_id = sqlx::query_scalar!(
        r#"
        SELECT id AS "id: Uuid"
        FROM markets
        WHERE market_pda = $1
        "#,
        market_pda
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO market_positions (
          market_id, user_pubkey, yes_bet_1e6, no_bet_1e6, claimed, tx_sig_claim
        )
        VALUES ($1, $2, 0, 0, TRUE, $3)
        ON CONFLICT (market_id, user_pubkey) DO UPDATE
        SET claimed      = TRUE,
            tx_sig_claim = COALESCE(market_positions.tx_sig_claim, EXCLUDED.tx_sig_claim)
        "#,
        market_id,
        user_pubkey,
        tx_sig_claim
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}


pub async fn fetch_recent_bets(
    pool: &PgPool,
    limit: i64,
    cursor: Option<i64>,
    market_pda: Option<&str>,
    user_address: Option<&str>,
) -> Result<RecentBetsPage> {
    let limit = limit.clamp(1, 200);

    let rows = sqlx::query!(
        r#"
        SELECT
          b.id                                        AS "cursor_id!: i64",
          b.user_pubkey                               AS "user_address!: String",
          b.side                                      AS "side!: String",
          (b.amount_1e6::numeric / 1000000.0)::float8 AS "amount!: f64",
          COALESCE(b.block_time, b.created_at)        AS "timestamp!: OffsetDateTime"
        FROM market_bets b
        JOIN markets m ON m.id = b.market_id
        WHERE ($1::bigint IS NULL OR b.id < $1)
          AND ($2::text   IS NULL OR m.market_pda = $2)
          AND ($3::text   IS NULL OR b.user_pubkey = $3)
        ORDER BY b.id DESC
        LIMIT $4
        "#,
        cursor,
        market_pda,
        user_address,
        limit + 1,
    )
    .fetch_all(pool)
    .await?;

    let mut items: Vec<RecentBet> = rows
        .into_iter()
        .map(|r| RecentBet {
            user_address: r.user_address,
            side: r.side,
            amount: r.amount,
            timestamp: r.timestamp,
            cursor_id: r.cursor_id,
        })
        .collect();

    let next_cursor = if items.len() as i64 > limit {
        Some(items.pop().unwrap().cursor_id)
    } else {
        None
    };

    Ok(RecentBetsPage { items, next_cursor })
}


pub async fn insert_bet_and_upsert_position(
    pool: &PgPool,
    market_id: Uuid,
    user_pubkey: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
    block_time: Option<OffsetDateTime>,
) -> Result<i64> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let was_participant: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
          SELECT 1 FROM market_positions
          WHERE market_id = $1 AND user_pubkey = $2
        ) AS "exists!"
        "#,
        market_id,
        user_pubkey
    )
    .fetch_one(&mut *tx)
    .await?;

    let side_str = if side_yes { "yes" } else { "no" };

    let row = sqlx::query!(
        r#"
        WITH ins AS (
          INSERT INTO market_bets (
            market_id, user_pubkey, side, amount_1e6, tx_sig, block_time
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (tx_sig) DO NOTHING
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM ins)                         AS "inserted_new!",
          COALESCE((SELECT id FROM ins),
                   (SELECT id FROM market_bets WHERE tx_sig = $5)) AS "bet_id!: i64"
        "#,
        market_id,
        user_pubkey,
        side_str,
        amount_1e6,
        tx_sig,
        block_time
    )
    .fetch_one(&mut *tx)
    .await?;

    let inserted_new = row.inserted_new;
    let bet_id = row.bet_id;

    if inserted_new {
        let (yes_delta, no_delta) = if side_yes { (amount_1e6, 0) } else { (0, amount_1e6) };

        sqlx::query!(
            r#"
            INSERT INTO market_positions (
              market_id, user_pubkey, yes_bet_1e6, no_bet_1e6, claimed, tx_sig_claim
            )
            VALUES ($1,$2,$3,$4,FALSE,NULL)
            ON CONFLICT (market_id, user_pubkey) DO UPDATE
              SET yes_bet_1e6 = market_positions.yes_bet_1e6 + EXCLUDED.yes_bet_1e6,
                  no_bet_1e6  = market_positions.no_bet_1e6  + EXCLUDED.no_bet_1e6
            "#,
            market_id,
            user_pubkey,
            yes_delta,
            no_delta
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            UPDATE market_state
            SET
              yes_total_1e6    = yes_total_1e6 + $2,
              no_total_1e6     = no_total_1e6  + $3,
              total_volume_1e6 = total_volume_1e6 + $4,
              participants     = participants + CASE WHEN $5 THEN 1 ELSE 0 END,
              updated_at       = NOW()
            WHERE market_id = $1
            "#,
            market_id,
            yes_delta,
            no_delta,
            amount_1e6,
            !was_participant
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(bet_id)
}