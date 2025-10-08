use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{PgPool, Transaction, Postgres};
use time::OffsetDateTime;
use anyhow::Result;
use uuid::Uuid;

pub enum BetKind {
    Active,
    History,
}
pub struct PositionRow {
    pub market_id: Uuid,
    pub market_pda: String,
    pub symbol: String,
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

fn decode_cursor(cur: &str) -> Option<(DateTime<Utc>, Uuid)> {
    let raw = general_purpose::STANDARD.decode(cur).ok()?;
    let s = String::from_utf8(raw).ok()?;
    let (a, b) = s.split_once('|')?;
    Some((a.parse().ok()?, b.parse().ok()?))
}


#[inline]
fn to_chrono(dt: OffsetDateTime) -> DateTime<Utc> {
    let secs = dt.unix_timestamp();
    let nanos = dt.nanosecond();
    let naive = NaiveDateTime::from_timestamp_opt(secs, nanos)
        .expect("valid timestamp");
    DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc)
}

pub async fn fetch_user_positions_page(
    pool: &PgPool,
    user_pubkey: &str,
    kind: BetKind,
    limit: i64,
    cursor: Option<&str>,
) -> Result<PositionsPage> {
    let fetch_limit = limit.clamp(1, 100) + 1;
    let (after_ts, after_market_id) = cursor.and_then(decode_cursor).unzip();
    let active_flag = matches!(kind, BetKind::Active);

    let after_ts_tz: Option<OffsetDateTime> = after_ts
        .map(|c| OffsetDateTime::from_unix_timestamp(c.timestamp()).expect("ts fits"));

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

    let mut items: Vec<PositionRow> = rows
        .into_iter()
        .map(|r| PositionRow {
            market_id: r.market_id,
            market_pda: r.market_pda,
            symbol: r.symbol,
            market_type: r.market_type,
            comparator: r.comparator,
            bound_lo_1e6: r.bound_lo_1e6,
            bound_hi_1e6: r.bound_hi_1e6,
            end_date_utc: to_chrono(r.end_date_utc), 
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
        })
        .collect();

    let next_cursor = if (items.len() as i64) > (fetch_limit - 1) {
        let last = items.pop().unwrap();
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
    side_yes: bool,
    amount_1e6: i64,
) -> anyhow::Result<()> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let was_participant: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM market_positions
           WHERE market_id = $1 AND user_pubkey = $2
        ) AS "exists!"
        "#,
        market_id,
        user_pubkey
    )
    .fetch_one(&mut *tx)
    .await?;

    let (yes_delta, no_delta) = if side_yes { (amount_1e6, 0) } else { (0, amount_1e6) };

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
          participants     = participants + CASE WHEN $5 THEN 1 ELSE 0 END
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

    tx.commit().await?;
    Ok(())
}