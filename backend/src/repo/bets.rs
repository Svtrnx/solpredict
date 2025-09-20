use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Transaction, Postgres};

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
    pub settled: bool,                    
    pub winning_side: Option<i32>,        
    pub end_date_utc: DateTime<Utc>,      
    pub symbol: String,                   
    pub market_type: String,              
    pub comparator: Option<String>,       
    pub bound_lo_1e6: Option<i64>,        
    pub bound_hi_1e6: Option<i64>,        
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
    // cursor -> i64 (id from market_bets)
    let after_id: Option<i64> = cursor
        .and_then(|c| general_purpose::STANDARD.decode(c).ok())
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|s| s.parse::<i64>().ok());

    let settled_val = matches!(kind, BetKind::History);
    let fetch_limit = limit + 1;

    // Get data from market_bets + market_view
    let sql_after = r#"
        SELECT
            b.id,
            b.side,
            b.amount_1e6,
            b.price_yes_bp_at_bet,
            mv.market_pda,
            mv.price_yes_bp,
            mv.settled,
            mv.winning_side,
            mv.end_date_utc,
            mv.symbol,
            mv.market_type,
            mv.comparator,
            mv.bound_lo_1e6,
            mv.bound_hi_1e6
        FROM market_bets b
        JOIN market_view mv ON mv.id = b.market_id
        WHERE b.user_pubkey = $1
          AND mv.settled = $2
          AND b.id < $3
        ORDER BY b.id DESC
        LIMIT $4
    "#;

    let sql_first = r#"
        SELECT
            b.id,
            b.side,
            b.amount_1e6,
            b.price_yes_bp_at_bet,
            mv.market_pda,
            mv.price_yes_bp,
            mv.settled,
            mv.winning_side,
            mv.end_date_utc,
            mv.symbol,
            mv.market_type,
            mv.comparator,
            mv.bound_lo_1e6,
            mv.bound_hi_1e6
        FROM market_bets b
        JOIN market_view mv ON mv.id = b.market_id
        WHERE b.user_pubkey = $1
          AND mv.settled = $2
        ORDER BY b.id DESC
        LIMIT $3
    "#;

    let rows: Vec<BetRow> = if let Some(aid) = after_id {
        sqlx::query_as::<_, BetRow>(sql_after)
            .bind(user_pubkey)
            .bind(settled_val)
            .bind(aid)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, BetRow>(sql_first)
            .bind(user_pubkey)
            .bind(settled_val)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
    };

    let mut items = rows;
    let next_cursor = if (items.len() as i64) > limit {
        let last = items.pop().unwrap();
        Some(general_purpose::STANDARD.encode(last.id.to_string()))
    } else {
        None
    };

    Ok(BetsPage { items, next_cursor })
}

pub async fn insert_bet_and_upsert_position(
    pool: &PgPool,
    market_id: uuid::Uuid,
    user_pubkey: &str,
    side_yes: bool,
    amount_1e6: i64,
    tx_sig: &str,
    block_time: Option<chrono::DateTime<chrono::Utc>>,
) -> anyhow::Result<Option<i64>> {
    let mut tx: Transaction<Postgres> = pool.begin().await?;

    let side_str = if side_yes { "yes" } else { "no" };

    // pools before insertion
    let (yes_before, no_before): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
        COALESCE( (SUM(CASE WHEN side='yes' THEN amount_1e6 ELSE 0 END))::BIGINT, 0 ) AS yes_total,
        COALESCE( (SUM(CASE WHEN side='no'  THEN amount_1e6 ELSE 0 END))::BIGINT, 0 ) AS no_total
        FROM market_bets
        WHERE market_id = $1
    "#,
    )
    .bind(market_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_before = yes_before + no_before;
    let price_yes_bp_at_bet: i32 = if total_before > 0 {
        (((yes_before as f64) / (total_before as f64)) * 10_000.0).round() as i32
    } else {
        5_000 // 50% when there is no pool (first bet/seed)
    };

    // Idempotent bet insertion with entry price
    let bet_id: Option<i64> = sqlx::query_scalar(
    r#"
        INSERT INTO market_bets
        (market_id, user_pubkey, side, amount_1e6,
        price_yes_bp_at_bet,
        yes_total_before_1e6, no_total_before_1e6,
        tx_sig, block_time)
        VALUES ($1, $2, $3, $4,
                $5,
                $6, $7,
                $8, $9)
        ON CONFLICT (tx_sig) DO NOTHING
        RETURNING id::BIGINT
    "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(side_str)
    .bind(amount_1e6)
    .bind(price_yes_bp_at_bet)
    .bind(yes_before)
    .bind(no_before) 
    .bind(tx_sig)
    .bind(block_time)
    .fetch_optional(&mut *tx)
    .await?;

    // If it's a duplicate, leave the position alone.
    if bet_id.is_none() {
        tx.rollback().await?;
        return Ok(None);
    }

    // Update of the user's aggregated position in the market
    let (yes_delta, no_delta) = if side_yes {
        (amount_1e6, 0)
    } else {
        (0, amount_1e6)
    };

    sqlx::query(
        r#"
        INSERT INTO market_positions (market_id, user_pubkey, yes_bet_1e6, no_bet_1e6)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (market_id, user_pubkey) DO UPDATE
        SET
          yes_bet_1e6 = market_positions.yes_bet_1e6 + EXCLUDED.yes_bet_1e6,
          no_bet_1e6  = market_positions.no_bet_1e6  + EXCLUDED.no_bet_1e6
        "#,
    )
    .bind(market_id)
    .bind(user_pubkey)
    .bind(yes_delta)
    .bind(no_delta)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(bet_id)
}
