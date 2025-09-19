use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub enum BetKind {
    Active,
    History,
}

#[derive(sqlx::FromRow)]
pub struct BetRow {
    pub id: i64,
    pub side: String,
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