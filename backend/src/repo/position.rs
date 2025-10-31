use anyhow::Context;
use anyhow::Result;
use base64::{Engine as _, engine::general_purpose};
use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

pub enum BetKind {
    Active,
    History,
}
pub struct PositionRow {
    pub market_id: Uuid,
    pub market_pda: String,
    pub symbol: Option<String>,
    pub market_type: String,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,

    pub end_date_utc: DateTime<Utc>,
    pub status: String,
    pub settled: bool,

    pub price_yes_bp: Option<i32>,
    pub yes_total_1e6: i64,
    pub no_total_1e6: i64,
    pub payout_pool_1e6: Option<i64>,

    pub claimed: bool,
    pub user_yes_bet_1e6: i64,
    pub user_no_bet_1e6: i64,

    pub winning_side: Option<i16>,      // 1=yes, 2=no, 3=void
    pub market_outcome: Option<String>, // "yes" | "no" | "void" | NULL
    pub needs_claim: bool,
    pub net_claim_1e6: Option<i64>,
}

pub struct PositionsPage {
    pub items: Vec<PositionRow>,
    pub next_cursor: Option<String>,
}

fn encode_cursor(ts: DateTime<Utc>, market_id: Uuid) -> String {
    general_purpose::STANDARD.encode(format!("{}|{}", ts.to_rfc3339(), market_id))
}

fn decode_cursor(cur: &str) -> Result<(DateTime<Utc>, Uuid)> {
    let raw = general_purpose::STANDARD
        .decode(cur)
        .context("Failed to base64 decode cursor")?;

    let s = String::from_utf8(raw).context("Cursor is not valid UTF-8")?;

    let (a, b) = s
        .split_once('|')
        .ok_or_else(|| anyhow::anyhow!("Cursor missing '|' delimiter"))?;

    let ts = a.parse().context("Failed to parse timestamp from cursor")?;

    let id = b.parse().context("Failed to parse UUID from cursor")?;

    Ok((ts, id))
}

#[inline]
fn to_chrono(dt: OffsetDateTime) -> Result<DateTime<Utc>> {
    let secs = dt.unix_timestamp();
    let nanos = dt.nanosecond();

    let naive = NaiveDateTime::from_timestamp_opt(secs, nanos)
        .ok_or_else(|| anyhow::anyhow!("Invalid timestamp: {}s {}ns", secs, nanos))?;

    Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
}

pub async fn fetch_user_positions_page(
    pool: &PgPool,
    user_pubkey: &str,
    kind: BetKind,
    limit: i64,
    cursor: Option<&str>,
) -> Result<PositionsPage> {
    if user_pubkey.is_empty() {
        return Err(anyhow::anyhow!("user_pubkey cannot be empty"));
    }

    let fetch_limit = limit.clamp(1, 100) + 1;

    let (after_ts, after_market_id) = match cursor {
        Some(c) => {
            let (ts, id) = decode_cursor(c)?;
            (Some(ts), Some(id))
        }
        None => (None, None),
    };

    let active_flag = matches!(kind, BetKind::Active);

    let after_ts_tz: Option<OffsetDateTime> = after_ts.map(|c| {
        OffsetDateTime::from_unix_timestamp_nanos(c.timestamp_nanos_opt().unwrap_or(0) as i128)
            .unwrap_or_else(|_| OffsetDateTime::UNIX_EPOCH)
    });

    let rows = sqlx::query!(
      r#"
      WITH base AS (
        SELECT
          mp.market_id,
          mv.market_pda,
          mv.symbol,
          mv.market_type,
          mv.comparator,
          mv.bound_lo_1e6,
          mv.bound_hi_1e6,

          mv.end_date_utc,
          mv.status,
          mv.settled,

          mv.price_yes_bp,
          mv.yes_total_1e6,
          mv.no_total_1e6,
          mv.payout_pool_1e6,

          mp.claimed,
          mp.yes_bet_1e6   AS user_yes_bet_1e6,
          mp.no_bet_1e6    AS user_no_bet_1e6,

          mv.winning_side,

          CASE
            WHEN mv.settled AND mv.winning_side = 1 THEN 'yes'
            WHEN mv.settled AND mv.winning_side = 2 THEN 'no'
            WHEN mv.settled AND mv.winning_side = 3 THEN 'void'
            ELSE NULL
          END AS market_outcome,

          CASE
            WHEN mv.settled = TRUE AND mp.claimed = FALSE AND (
              (mv.winning_side = 3 AND (mp.yes_bet_1e6 + mp.no_bet_1e6) > 0) OR
              (mv.winning_side = 1 AND mp.yes_bet_1e6 > 0) OR
              (mv.winning_side = 2 AND mp.no_bet_1e6  > 0)
            )
            THEN TRUE ELSE FALSE
          END AS needs_claim,

          CASE
            WHEN mv.settled = TRUE AND mv.winning_side = 3 THEN
              (mp.yes_bet_1e6 + mp.no_bet_1e6)
            WHEN mv.settled = TRUE AND mv.winning_side IN (1,2)
                  AND (CASE WHEN mv.winning_side = 1 THEN mv.yes_total_1e6 ELSE mv.no_total_1e6 END) > 0
            THEN
              FLOOR(
                (mv.payout_pool_1e6::NUMERIC *
                  (CASE WHEN mv.winning_side = 1 THEN mp.yes_bet_1e6 ELSE mp.no_bet_1e6 END)::NUMERIC
                )
                /
                NULLIF(
                  (CASE WHEN mv.winning_side = 1 THEN mv.yes_total_1e6 ELSE mv.no_total_1e6 END)::NUMERIC,
                  0
                )
              )::BIGINT
            ELSE NULL
          END AS net_claim_1e6
        FROM market_positions mp
        JOIN market_view mv ON mv.id = mp.market_id
        WHERE mp.user_pubkey = $1
          AND (
                ($3::bool = TRUE  AND (mv.settled = FALSE OR (mv.settled = TRUE AND mp.claimed = FALSE)))
              OR ($3::bool = FALSE AND  (mv.settled = TRUE  AND mp.claimed = TRUE))
          )
          AND (
                $4::timestamptz IS NULL OR $5::uuid IS NULL
                OR (mv.end_date_utc < $4 OR (mv.end_date_utc = $4 AND mp.market_id < $5))
          )
        ORDER BY mv.end_date_utc DESC, mp.market_id DESC
        LIMIT $2
      )
      SELECT
        market_id,
        market_pda        AS "market_pda!",
        symbol            AS "symbol!",
        market_type       AS "market_type!",
        comparator,
        bound_lo_1e6,
        bound_hi_1e6,
        end_date_utc      AS "end_date_utc!",
        status            AS "status!",
        settled           AS "settled!",
        price_yes_bp,
        yes_total_1e6     AS "yes_total_1e6!",
        no_total_1e6      AS "no_total_1e6!",
        payout_pool_1e6,
        claimed,
        user_yes_bet_1e6  AS "user_yes_bet_1e6!",
        user_no_bet_1e6   AS "user_no_bet_1e6!",
        winning_side,
        market_outcome,
        needs_claim        AS "needs_claim!",
        net_claim_1e6
      FROM base
      "#,
      user_pubkey,        // $1
      fetch_limit,        // $2
      active_flag,        // $3
      after_ts_tz,        // $4 Option<OffsetDateTime>
      after_market_id     // $5 Option<Uuid>
  )
  .fetch_all(pool)
  .await?;

    let mut items: Vec<PositionRow> = Vec::with_capacity(rows.len());
    for r in rows {
        let end_date_utc = to_chrono(r.end_date_utc).context("Failed to convert end_date_utc")?;

        items.push(PositionRow {
            market_id: r.market_id,
            market_pda: r.market_pda,
            symbol: Some(r.symbol),
            market_type: r.market_type,
            comparator: r.comparator,
            bound_lo_1e6: r.bound_lo_1e6,
            bound_hi_1e6: r.bound_hi_1e6,
            end_date_utc,
            status: r.status,
            settled: r.settled,
            price_yes_bp: r.price_yes_bp,
            yes_total_1e6: r.yes_total_1e6,
            no_total_1e6: r.no_total_1e6,
            payout_pool_1e6: r.payout_pool_1e6,
            claimed: r.claimed,
            user_yes_bet_1e6: r.user_yes_bet_1e6,
            user_no_bet_1e6: r.user_no_bet_1e6,
            winning_side: r.winning_side,
            market_outcome: r.market_outcome,
            needs_claim: r.needs_claim,
            net_claim_1e6: r.net_claim_1e6,
        });
    }

    let next_cursor = if (items.len() as i64) > (fetch_limit - 1) {
        let last = items
            .pop()
            .ok_or_else(|| anyhow::anyhow!("Expected item for cursor"))?;
        Some(encode_cursor(last.end_date_utc, last.market_id))
    } else {
        None
    };

    Ok(PositionsPage { items, next_cursor })
}

pub async fn apply_bet_to_position(
    pool: &PgPool,
    market_id: Uuid,
    user_pubkey: &str,
    outcome_idx: u8,
    amount_1e6: i64,
) -> anyhow::Result<()> {
    if user_pubkey.is_empty() {
        return Err(anyhow::anyhow!("user_pubkey cannot be empty"));
    }

    if amount_1e6 <= 0 {
        return Err(anyhow::anyhow!("amount_1e6 must be positive"));
    }

    const MAX_AMOUNT: i64 = 1_000_000_000_000_000;
    if amount_1e6 > MAX_AMOUNT {
        return Err(anyhow::anyhow!("amount_1e6 exceeds maximum"));
    }

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await
        .context("Failed to set transaction isolation level")?;

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
          VALUES ($1, $2, $3, $4, FALSE, NULL)
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
        // Multi-outcome market
        let outcome_idx_i16 = outcome_idx as i16;

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

        // Update tvl_per_outcome_1e6 array
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

    tx.commit().await?;

    let side_str = match outcome_idx {
        0 => "yes",
        1 => "no",
        _ => "custom",
    };

    tracing::info!(
      market_id = %market_id,
      user = %user_pubkey,
      outcome_idx = outcome_idx,
      side = side_str,
      amount = amount_1e6,
      "Position updated successfully"
    );

    Ok(())
}
