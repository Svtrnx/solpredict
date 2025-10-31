use anyhow::{Context, Result};
use serde::Serialize;
use sqlx::{PgPool, Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentBet {
    pub user_address: String,
    pub side: String, // DEPRECATED: kept for backward compatibility
    pub outcome_idx: i16,
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
    if market_pda.is_empty() {
        return Err(anyhow::anyhow!("market_pda cannot be empty"));
    }
    if user_pubkey.is_empty() {
        return Err(anyhow::anyhow!("user_pubkey cannot be empty"));
    }
    if tx_sig_claim.is_empty() {
        return Err(anyhow::anyhow!("tx_sig_claim cannot be empty"));
    }

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await
        .context("Failed to set transaction isolation level")?;

    let market_row = sqlx::query!(
        r#"
        SELECT 
            id AS "id: Uuid",
            status AS "status!"
        FROM market_view
        WHERE market_pda = $1
        "#,
        market_pda
    )
    .fetch_optional(&mut *tx)
    .await?;

    let market_row =
        market_row.ok_or_else(|| anyhow::anyhow!("Market with PDA '{}' not found", market_pda))?;

    let market_id = market_row.id;

    if !matches!(market_row.status.as_str(), "settled_yes" | "settled_no") {
        return Err(anyhow::anyhow!(
            "Cannot claim: market status is '{}', must be settled",
            market_row.status
        ));
    }

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

    tracing::info!(
        market_pda = %market_pda,
        user = %user_pubkey,
        tx_sig = %tx_sig_claim,
        "Position marked as claimed"
    );

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
          b.outcome_idx                               AS "outcome_idx!: i16",
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

    let has_more = rows.len() as i64 > limit;

    let mut items: Vec<RecentBet> = rows
        .into_iter()
        .take(limit as usize)
        .map(|r| RecentBet {
            user_address: r.user_address,
            side: r.side,
            outcome_idx: r.outcome_idx,
            amount: r.amount,
            timestamp: r.timestamp,
            cursor_id: r.cursor_id,
        })
        .collect();

    let next_cursor = if has_more {
        items.pop().map(|item| item.cursor_id)
    } else {
        None
    };

    Ok(RecentBetsPage { items, next_cursor })
}

pub async fn insert_bet_and_upsert_position(
    pool: &PgPool,
    market_id: Uuid,
    user_pubkey: &str,
    outcome_idx: u8,
    amount_1e6: i64,
    tx_sig: &str,
    block_time: Option<OffsetDateTime>,
) -> Result<i64> {
    if amount_1e6 <= 0 {
        return Err(anyhow::anyhow!("Bet amount must be positive"));
    }

    const MAX_BET_AMOUNT: i64 = 1_000_000_000_000; // 1M * 1e6
    if amount_1e6 > MAX_BET_AMOUNT {
        return Err(anyhow::anyhow!(
            "Bet amount exceeds maximum allowed ({} USD)",
            MAX_BET_AMOUNT / 1_000_000
        ));
    }

    const MIN_BET_AMOUNT: i64 = 10_000; // 0.01 * 1e6
    if amount_1e6 < MIN_BET_AMOUNT {
        return Err(anyhow::anyhow!(
            "Bet amount below minimum ({} USD)",
            MIN_BET_AMOUNT as f64 / 1_000_000.0
        ));
    }

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await
        .context("Failed to set transaction isolation level")?;

    let market = sqlx::query!(
        r#"
        SELECT 
            status AS "status!",
            end_date_utc AS "end_date_utc!: OffsetDateTime"
        FROM market_view
        WHERE id = $1
        "#,
        market_id
    )
    .fetch_optional(&mut *tx)
    .await?;

    let market = market.ok_or_else(|| anyhow::anyhow!("Market not found"))?;

    if market.status != "active" {
        return Err(anyhow::anyhow!(
            "Cannot place bet: market status is '{}', must be 'active'",
            market.status
        ));
    }

    if market.end_date_utc < OffsetDateTime::now_utc() {
        return Err(anyhow::anyhow!(
            "Cannot place bet: market ended at {}",
            market.end_date_utc
        ));
    }

    let market_state = sqlx::query!(
        r#"
        SELECT 
            yes_total_1e6 AS "yes_total_1e6!: i64",
            no_total_1e6 AS "no_total_1e6!: i64",
            total_volume_1e6 AS "total_volume_1e6!: i64"
        FROM market_state
        WHERE market_id = $1
        "#,
        market_id
    )
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(state) = market_state {
        const MAX_SAFE_TOTAL: i64 = i64::MAX / 10 * 9;

        if state.total_volume_1e6 > MAX_SAFE_TOTAL - amount_1e6 {
            return Err(anyhow::anyhow!("Market volume would exceed safe limits"));
        }
    }

    // Convert outcome_idx to legacy side for backward compatibility
    let side_str = match outcome_idx {
        0 => "yes",
        1 => "no",
        _ => "custom",
    };

    let outcome_idx_i16 = outcome_idx as i16;

    let row = sqlx::query!(
        r#"
        WITH ins AS (
          INSERT INTO market_bets (
            market_id, user_pubkey, side, outcome_idx, amount_1e6, tx_sig, block_time
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (tx_sig) DO NOTHING
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM ins)                         AS "inserted_new!",
          COALESCE((SELECT id FROM ins),
                   (SELECT id FROM market_bets WHERE tx_sig = $6)) AS "bet_id!: i64"
        "#,
        market_id,
        user_pubkey,
        side_str,
        outcome_idx_i16,
        amount_1e6,
        tx_sig,
        block_time
    )
    .fetch_one(&mut *tx)
    .await?;

    let inserted_new = row.inserted_new;
    let bet_id = row.bet_id;

    if inserted_new {
        // For binary markets (outcome 0 or 1), update legacy positions table
        // For multi-outcome markets, update the new positions_multi table
        if outcome_idx <= 1 {
            let (yes_delta, no_delta) = if outcome_idx == 0 {
                (amount_1e6, 0)
            } else {
                (0, amount_1e6)
            };

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
                  participants     = (
                    SELECT COUNT(DISTINCT user_pubkey)
                    FROM market_positions
                    WHERE market_id = $1
                  ),
                  updated_at       = NOW()
                WHERE market_id = $1
                "#,
                market_id,
                yes_delta,
                no_delta,
                amount_1e6
            )
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query!(
                r#"
                INSERT INTO market_positions_multi (
                  market_id, user_pubkey, outcome_idx, stake_1e6, claimed, tx_sig_claim
                )
                VALUES ($1, $2, $3, $4, FALSE, NULL)
                ON CONFLICT (market_id, user_pubkey, outcome_idx) DO UPDATE
                  SET stake_1e6 = market_positions_multi.stake_1e6 + EXCLUDED.stake_1e6
                "#,
                market_id,
                user_pubkey,
                outcome_idx_i16,
                amount_1e6
            )
            .execute(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                UPDATE market_state
                SET
                  tvl_per_outcome_1e6 = jsonb_set(
                    COALESCE(tvl_per_outcome_1e6, '[]'::jsonb),
                    ARRAY[$2::text],
                    to_jsonb(COALESCE((tvl_per_outcome_1e6->$2)::bigint, 0) + $3),
                    true
                  ),
                  total_volume_1e6 = total_volume_1e6 + $3,
                  participants = (
                    SELECT COUNT(DISTINCT user_pubkey)
                    FROM market_positions_multi
                    WHERE market_id = $1
                  ),
                  updated_at = NOW()
                WHERE market_id = $1
                "#,
                market_id,
                outcome_idx_i16.to_string(),
                amount_1e6
            )
            .execute(&mut *tx)
            .await?;
        }

        tracing::info!(
            market_id = %market_id,
            user = %user_pubkey,
            outcome_idx = outcome_idx,
            side = %side_str,
            amount = amount_1e6,
            tx_sig = %tx_sig,
            "New bet inserted successfully"
        );
    } else {
        tracing::debug!(
            tx_sig = %tx_sig,
            bet_id = bet_id,
            "Duplicate bet transaction detected, skipping state update"
        );
    }

    tx.commit().await?;
    Ok(bet_id)
}
