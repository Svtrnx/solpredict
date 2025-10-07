use base64::{engine::general_purpose, Engine as _};
use sqlx::{PgPool, Transaction, Postgres, Row};
use chrono::{DateTime, Utc};
use anyhow::Result;
use anyhow::bail;
use uuid::Uuid;

pub enum BetKind {
    Active,
    History,
}
#[derive(sqlx::FromRow)]
pub struct BetRow {
    pub id: i64,
    pub side: String,
    pub market_pda: String,

    pub amount_1e6: i64,

    pub price_yes_bp_at_bet: Option<i32>,
    pub price_yes_bp: Option<i32>,
    pub side_bp: Option<i32>,

    pub settled: bool,
    pub winning_side: Option<i16>,
    pub end_date_utc: chrono::DateTime<chrono::Utc>,
    pub symbol: String,
    pub market_type: String,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,

    pub market_outcome: Option<String>,
    pub needs_claim: bool,

    pub payout_pool_1e6: Option<i64>,
    pub yes_total_1e6: i64,
    pub no_total_1e6: i64,

    pub user_yes_bet_1e6: i64,
    pub user_no_bet_1e6: i64,

    pub total_winning_side_1e6: Option<i64>,
    pub user_winning_amount_1e6: i64,

    pub net_claim_1e6: Option<i64>,
}

pub struct BetsPage {
    pub items: Vec<BetRow>,
    pub next_cursor: Option<String>, // base64(id)
}


pub async fn fetch_user_bets_page(
    pool: &PgPool,
    user_pubkey: &str,
    kind: BetKind,
    limit: i64,
    cursor: Option<&str>,
) -> Result<BetsPage> {
    let after_id: Option<i64> = cursor
        .and_then(|c| general_purpose::STANDARD.decode(c).ok())
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|s| s.parse::<i64>().ok());

    let fetch_limit = limit.clamp(1, 100) + 1;

    const BASE_SELECT: &str = r#"
      WITH base AS (
        SELECT
          b.id,
          b.side,
          b.amount_1e6,
          b.price_yes_bp_at_bet,

          mv.market_pda,
          mv.price_yes_bp,

          CASE
            WHEN b.side = 'yes' THEN mv.price_yes_bp
            ELSE (10000 - mv.price_yes_bp)
          END AS side_bp,

          mv.settled,
          mv.winning_side,
          mv.end_date_utc,
          mv.symbol,
          mv.market_type,
          mv.comparator,
          mv.bound_lo_1e6,
          mv.bound_hi_1e6,

          CASE
            WHEN mv.settled AND mv.winning_side = 1 THEN 'yes'
            WHEN mv.settled AND mv.winning_side = 2 THEN 'no'
            WHEN mv.settled AND mv.winning_side = 3 THEN 'void'
            ELSE NULL
          END AS market_outcome,

          COALESCE(
            mp.yes_bet_1e6,
            (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
               FROM market_bets mb
              WHERE mb.market_id = b.market_id
                AND mb.user_pubkey = b.user_pubkey
                AND mb.side = 'yes')
          ) AS user_yes_bet_1e6,

          COALESCE(
            mp.no_bet_1e6,
            (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
               FROM market_bets mb
              WHERE mb.market_id = b.market_id
                AND mb.user_pubkey = b.user_pubkey
                AND mb.side = 'no')
          ) AS user_no_bet_1e6,

          COALESCE(mp.claimed, FALSE) AS claimed,

          mv.payout_pool_1e6,
          mv.yes_total_1e6,
          mv.no_total_1e6,

          CASE
            WHEN mv.winning_side = 1 THEN mv.yes_total_1e6
            WHEN mv.winning_side = 2 THEN mv.no_total_1e6
            ELSE NULL
          END AS total_winning_side_1e6,

          CASE
            WHEN mv.winning_side = 1 THEN
              COALESCE(
                mp.yes_bet_1e6,
                (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                   FROM market_bets mb
                  WHERE mb.market_id = b.market_id
                    AND mb.user_pubkey = b.user_pubkey
                    AND mb.side = 'yes'),
                0
              )
            WHEN mv.winning_side = 2 THEN
              COALESCE(
                mp.no_bet_1e6,
                (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                   FROM market_bets mb
                  WHERE mb.market_id = b.market_id
                    AND mb.user_pubkey = b.user_pubkey
                    AND mb.side = 'no'),
                0
              )
            WHEN mv.winning_side = 3 THEN
              COALESCE(
                mp.yes_bet_1e6,
                (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                   FROM market_bets mb
                  WHERE mb.market_id = b.market_id
                    AND mb.user_pubkey = b.user_pubkey
                    AND mb.side = 'yes'),
                0
              )
              +
              COALESCE(
                mp.no_bet_1e6,
                (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                   FROM market_bets mb
                  WHERE mb.market_id = b.market_id
                    AND mb.user_pubkey = b.user_pubkey
                    AND mb.side = 'no'),
                0
              )
            ELSE 0
          END AS user_winning_amount_1e6,

          CASE
            WHEN mv.settled = TRUE
             AND COALESCE(mp.claimed, FALSE) = FALSE
             AND (
               (mv.winning_side = 3 AND (
                  COALESCE(
                    mp.yes_bet_1e6,
                    (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                       FROM market_bets mb
                      WHERE mb.market_id = b.market_id
                        AND mb.user_pubkey = b.user_pubkey
                        AND mb.side = 'yes'), 0
                  )
                  +
                  COALESCE(
                    mp.no_bet_1e6,
                    (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                       FROM market_bets mb
                      WHERE mb.market_id = b.market_id
                        AND mb.user_pubkey = b.user_pubkey
                        AND mb.side = 'no'), 0
                  )
               ) > 0)
               OR (mv.winning_side = 1 AND COALESCE(
                    mp.yes_bet_1e6,
                    (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                       FROM market_bets mb
                      WHERE mb.market_id = b.market_id
                        AND mb.user_pubkey = b.user_pubkey
                        AND mb.side = 'yes'), 0
                  ) > 0)
               OR (mv.winning_side = 2 AND COALESCE(
                    mp.no_bet_1e6,
                    (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                       FROM market_bets mb
                      WHERE mb.market_id = b.market_id
                        AND mb.user_pubkey = b.user_pubkey
                        AND mb.side = 'no'), 0
                  ) > 0)
             )
            THEN TRUE
            ELSE FALSE
          END AS needs_claim,

          CASE
            WHEN mv.settled = TRUE AND mv.winning_side = 3 THEN
              (
                COALESCE(
                  mp.yes_bet_1e6,
                  (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                     FROM market_bets mb
                    WHERE mb.market_id = b.market_id
                      AND mb.user_pubkey = b.user_pubkey
                      AND mb.side = 'yes'), 0
                )
                +
                COALESCE(
                  mp.no_bet_1e6,
                  (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                     FROM market_bets mb
                    WHERE mb.market_id = b.market_id
                      AND mb.user_pubkey = b.user_pubkey
                      AND mb.side = 'no'), 0
                )
              )::BIGINT
            WHEN mv.settled = TRUE AND mv.winning_side IN (1,2)
                 AND (CASE WHEN mv.winning_side = 1 THEN mv.yes_total_1e6 ELSE mv.no_total_1e6 END) > 0
            THEN
              FLOOR(
                (mv.payout_pool_1e6::NUMERIC *
                  (CASE WHEN mv.winning_side = 1 THEN
                     COALESCE(
                       mp.yes_bet_1e6,
                       (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                          FROM market_bets mb
                         WHERE mb.market_id = b.market_id
                           AND mb.user_pubkey = b.user_pubkey
                           AND mb.side = 'yes'), 0
                     )::NUMERIC
                   ELSE
                     COALESCE(
                       mp.no_bet_1e6,
                       (SELECT COALESCE(SUM(mb.amount_1e6), 0)::BIGINT
                          FROM market_bets mb
                         WHERE mb.market_id = b.market_id
                           AND mb.user_pubkey = b.user_pubkey
                           AND mb.side = 'no'), 0
                     )::NUMERIC
                   END)
                )
                /
                NULLIF(
                  (CASE WHEN mv.winning_side = 1 THEN mv.yes_total_1e6 ELSE mv.no_total_1e6 END)::NUMERIC,
                  0
                )
              )::BIGINT
            ELSE NULL
          END AS net_claim_1e6

        FROM market_bets b
        JOIN market_view mv ON mv.id = b.market_id
        LEFT JOIN market_positions mp
               ON mp.market_id   = b.market_id
              AND mp.user_pubkey = b.user_pubkey
        WHERE b.user_pubkey = $1
      )
    "#;

    let (sql_first, sql_after) = match kind {
        BetKind::Active => (
            &format!(r#"
              {BASE}
              SELECT *
              FROM base
              WHERE (settled = FALSE OR needs_claim = TRUE)
              ORDER BY id DESC
              LIMIT $2
            "#, BASE = BASE_SELECT),
            &format!(r#"
              {BASE}
              SELECT *
              FROM base
              WHERE (settled = FALSE OR needs_claim = TRUE)
                AND id < $2
              ORDER BY id DESC
              LIMIT $3
            "#, BASE = BASE_SELECT),
        ),
        BetKind::History => (
            &format!(r#"
              {BASE}
              SELECT *
              FROM base
              WHERE settled = TRUE
                AND needs_claim = FALSE
              ORDER BY id DESC
              LIMIT $2
            "#, BASE = BASE_SELECT),
            &format!(r#"
              {BASE}
              SELECT *
              FROM base
              WHERE settled = TRUE
                AND needs_claim = FALSE
                AND id < $2
              ORDER BY id DESC
              LIMIT $3
            "#, BASE = BASE_SELECT),
        ),
    };

    let rows: Vec<BetRow> = if let Some(aid) = after_id {
        sqlx::query_as::<_, BetRow>(&sql_after)
            .bind(user_pubkey)
            .bind(aid)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, BetRow>(&sql_first)
            .bind(user_pubkey)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
    };

    let mut items = rows;
    let next_cursor = if (items.len() as i64) > (fetch_limit - 1) {
        let last = items.pop().unwrap();
        Some(general_purpose::STANDARD.encode(last.id.to_string()))
    } else {
        None
    };

    Ok(BetsPage { items, next_cursor })
}



pub async fn insert_bet_and_upsert_position(
    pool: &PgPool,
    market_id: Uuid,
    user_pubkey: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
    block_time: Option<DateTime<Utc>>,
) -> anyhow::Result<i64> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let was_participant: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
              SELECT 1 FROM market_bets
              WHERE market_id = $1 AND user_pubkey = $2
           )"#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .fetch_one(&mut *tx)
    .await?;

    let side_str = if side_yes { "yes" } else { "no" };

    let row = sqlx::query(
        r#"
        WITH ins AS (
          INSERT INTO market_bets (
            market_id, user_pubkey, side, amount_1e6, tx_sig, block_time
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tx_sig) DO NOTHING
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM ins) AS inserted_new,
          COALESCE((SELECT id FROM ins),
                   (SELECT id FROM market_bets WHERE tx_sig = $5)) AS bet_id
        "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(side_str)
    .bind(amount_1e6)
    .bind(tx_sig)
    .bind(block_time)
    .fetch_one(&mut *tx)
    .await?;

    let inserted_new: bool = row.try_get::<bool, _>("inserted_new")?;
    let bet_id: i64 = row.try_get::<i64, _>("bet_id")?;

    if inserted_new {
        let (yes_delta, no_delta) = if side_yes { (amount_1e6, 0) } else { (0, amount_1e6) };

        sqlx::query(
            r#"
            INSERT INTO market_positions (
              market_id, user_pubkey, yes_bet_1e6, no_bet_1e6, claimed, tx_sig_claim
            )
            VALUES ($1, $2, $3, $4, FALSE, NULL)
            ON CONFLICT (market_id, user_pubkey) DO UPDATE
            SET yes_bet_1e6 = market_positions.yes_bet_1e6 + EXCLUDED.yes_bet_1e6,
                no_bet_1e6  = market_positions.no_bet_1e6  + EXCLUDED.no_bet_1e6
            "#,
        )
        .bind(market_id)
        .bind(user_pubkey)
        .bind(yes_delta)
        .bind(no_delta)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE market_state
            SET
              yes_total_1e6    = yes_total_1e6 + $2,
              no_total_1e6     = no_total_1e6  + $3,
              total_volume_1e6 = total_volume_1e6 + $4,
              participants     = participants + CASE WHEN $5 THEN 1 ELSE 0 END
            WHERE market_id = $1
            "#,
        )
        .bind(market_id)
        .bind(yes_delta)
        .bind(no_delta)
        .bind(amount_1e6)
        .bind(!was_participant)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(bet_id)
}

pub async fn mark_position_claimed_by_pda(
    pool: &PgPool,
    market_pda: &str,
    user_pubkey: &str,
    tx_sig_claim: &str,
) -> Result<()> {
    let mut tx = pool.begin().await?;

    let market_id: Uuid = sqlx::query_scalar(
        r#"SELECT id FROM markets WHERE market_pda = $1"#,
    )
    .bind(market_pda)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO market_positions (
          market_id, user_pubkey, yes_bet_1e6, no_bet_1e6, claimed, tx_sig_claim
        )
        VALUES ($1, $2, 0, 0, TRUE, $3)
        ON CONFLICT (market_id, user_pubkey) DO UPDATE
        SET claimed      = TRUE,
            tx_sig_claim = COALESCE(market_positions.tx_sig_claim, EXCLUDED.tx_sig_claim)
        "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(tx_sig_claim)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}
