use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use anyhow::Result;
use uuid::Uuid;

use crate::handlers::market::types::{Comparator, MarketType, MarketCategory, CreateMarketRequest};

#[derive(Debug, sqlx::FromRow)]
pub struct MarketRowInsert {
    pub id: uuid::Uuid,
}

pub struct MarketRowFetch {
    pub id: Uuid,
    pub category: String,
    pub market_pda: String,
    pub total_volume_1e6: i64,
    pub participants: i32,
    pub price_yes_bp: Option<i32>,
    pub end_date_utc: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub symbol: String,
    pub market_type: String,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,
}

#[derive(sqlx::FromRow, Debug)]
pub struct MarketRow {
    pub id: uuid::Uuid,
    pub market_pda: String,
    pub creator: String,
    pub category: String,
    pub symbol: String,
    pub end_date_utc: chrono::DateTime<chrono::Utc>,

    pub market_type: String,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,

    pub initial_liquidity_1e6: i64,
    pub yes_total_1e6: i64,
    pub no_total_1e6: i64,
    pub total_volume_1e6: i64,
    pub participants: i32,

    pub price_yes_bp: Option<i32>,
    pub status: String,
    pub resolver_pubkey: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MarketViewRow {
    pub id: Uuid,
    pub market_pda: String,
    pub status: String,
    pub price_feed_account: String,
    pub end_date_utc: Option<chrono::DateTime<chrono::Utc>>,
}

pub struct MarketsPage {
    pub items: Vec<MarketRowFetch>,
    pub next_cursor: Option<String>,
}

// Map enums into DB-friendly string values
fn market_type_str(mt: MarketType) -> &'static str {
    match mt {
        MarketType::PriceThreshold => "price-threshold",
        MarketType::PriceRange => "price-range",
    }
}

fn category_str(c: MarketCategory) -> &'static str {
    match c {
        MarketCategory::Crypto => "crypto",
    }
}
fn comparator_str(c: Comparator) -> &'static str {
    match c {
        Comparator::Gte => ">=",
        Comparator::Gt => ">",
        Comparator::Lte => "<=",
        Comparator::Lt => "<",
        Comparator::Eq => "=",
        Comparator::Empty => "",
    }
}

/// Insert new confirmed market row
pub async fn insert_confirmed_market(
    pool: &sqlx::PgPool,
    req: &CreateMarketRequest,
    market_pda: &str,
    authority_pubkey: &str,
    tx_sig_create: &str,
    price_feed_account: &str,
    mint: &str,
    bound_lo_1e6: i64,
    bound_hi_1e6: i64,
) -> anyhow::Result<uuid::Uuid> {
    let initial_liquidity_1e6 = (req.initial_liquidity * 1_000_000.0).round() as i64;

    let rec = sqlx::query_as::<_, MarketRowInsert>(
        r#"
        INSERT INTO markets (
          market_pda, authority_pubkey, tx_sig_create,
          category, symbol,
          market_type, comparator, bound_lo_1e6, bound_hi_1e6, end_date_utc,
          feed_id, price_feed_account, mint,
          initial_liquidity_1e6
        )
        VALUES ($1,$2,$3,
                $4,$5,
                $6,$7,$8,$9,$10,
                $11,$12,$13,
                $14)
        RETURNING id
    "#,
    )
    .bind(market_pda)
    .bind(authority_pubkey)
    .bind(tx_sig_create)
    .bind(category_str(req.category))
    .bind(&req.symbol)
    .bind(market_type_str(req.market_type))
    .bind(comparator_str(req.comparator))
    .bind(bound_lo_1e6)
    .bind(bound_hi_1e6)
    .bind(req.end_date)
    .bind(&req.feed_id)
    .bind(price_feed_account)
    .bind(mint)
    .bind(initial_liquidity_1e6)
    .fetch_one(pool)
    .await?;

    Ok(rec.id)
}

pub async fn upsert_initial_state(
    pool: &sqlx::PgPool,
    market_id: uuid::Uuid,
    yes_total_1e6: i64,
    no_total_1e6: i64,
    participants: i32,
) -> anyhow::Result<()> {
    let total = yes_total_1e6 + no_total_1e6;

    sqlx::query(
        r#"
        INSERT INTO market_state (
          market_id, yes_total_1e6, no_total_1e6, total_volume_1e6, participants
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (market_id) DO UPDATE SET
          yes_total_1e6     = EXCLUDED.yes_total_1e6,
          no_total_1e6      = EXCLUDED.no_total_1e6,
          total_volume_1e6  = EXCLUDED.total_volume_1e6,
          participants      = EXCLUDED.participants,
          updated_at        = now()
    "#,
    )
    .bind(market_id)
    .bind(yes_total_1e6)
    .bind(no_total_1e6)
    .bind(total)
    .bind(participants)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_markets_page(
    pool: &PgPool,
    limit: i64,
    cursor: Option<&str>,
    category: Option<&str>,
) -> Result<MarketsPage> {
    // decoding the cursor "{ts}|{uuid}"
    let (cur_ts, cur_id) = if let Some(c) = cursor {
        let raw = general_purpose::STANDARD.decode(c)?;
        let s = String::from_utf8(raw)?;
        let (ts_s, id_s) = s.split_once('|').unwrap_or(("", ""));
        let ts = ts_s.parse::<DateTime<Utc>>().ok();
        let id = Uuid::parse_str(id_s).ok();
        (ts, id)
    } else {
        (None, None)
    };

    let mut sql = String::from(
        r#"
            SELECT
            id, market_pda, category, total_volume_1e6, participants, price_yes_bp, end_date_utc, updated_at,
            symbol, market_type, comparator, bound_lo_1e6, bound_hi_1e6
            FROM market_view
            WHERE 1=1
        "#,
    );

    // filters
    if category.is_some() {
        sql.push_str(" AND category = $CAT ");
    }

    // keyset: "strictly less than" by (updated_at desc, id desc)
    if cur_ts.is_some() && cur_id.is_some() {
        sql.push_str(" AND (updated_at, id) < ($CUR_TS, $CUR_ID) ");
    }

    sql.push_str(" ORDER BY updated_at DESC, id DESC LIMIT $LIM ");

    let rows = if category.is_some() && cur_ts.is_some() {
        sqlx::query(
            &sql.replace("$CAT", "$1")
                .replace("$CUR_TS", "$2")
                .replace("$CUR_ID", "$3")
                .replace("$LIM", "$4"),
        )
        .bind(category.unwrap())
        .bind(cur_ts.unwrap())
        .bind(cur_id.unwrap())
        .bind(limit + 1) // get +1 to see if there is a continuation
        .fetch_all(pool)
        .await?
    } else if category.is_some() {
        sqlx::query(&sql.replace("$CAT", "$1").replace("$LIM", "$2"))
            .bind(category.unwrap())
            .bind(limit + 1)
            .fetch_all(pool)
            .await?
    } else if cur_ts.is_some() {
        sqlx::query(
            &sql.replace("$CUR_TS", "$1")
                .replace("$CUR_ID", "$2")
                .replace("$LIM", "$3"),
        )
        .bind(cur_ts.unwrap())
        .bind(cur_id.unwrap())
        .bind(limit + 1)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query(&sql.replace("$LIM", "$1"))
            .bind(limit + 1)
            .fetch_all(pool)
            .await?
    };

    let mut out = Vec::with_capacity(rows.len());
    for r in rows.iter().take(limit as usize) {
        out.push(MarketRowFetch {
            id: r.try_get("id")?,
            category: r.try_get("category")?,
            market_pda: r.try_get("market_pda")?,
            total_volume_1e6: r.try_get("total_volume_1e6")?,
            participants: r.try_get("participants")?,
            price_yes_bp: r.try_get("price_yes_bp")?,
            end_date_utc: r.try_get("end_date_utc")?,
            updated_at: r.try_get("updated_at")?,
            symbol: r.try_get("symbol")?,
            market_type: r.try_get("market_type")?,
            comparator: r.try_get("comparator")?,
            bound_lo_1e6: r.try_get("bound_lo_1e6")?,
            bound_hi_1e6: r.try_get("bound_hi_1e6")?,

        });
    }

    // next cursor (if was +1)
    let next_cursor = if rows.len() as i64 > limit {
        if let Some(last) = out.last() {
            let s = format!("{}|{}", last.updated_at.to_rfc3339(), last.id);
            Some(general_purpose::STANDARD.encode(s.as_bytes()))
        } else {
            None
        }
    } else {
        None
    };

    Ok(MarketsPage {
        items: out,
        next_cursor,
    })
}
pub async fn find_by_address(pool: &PgPool, market_pda: &str) -> Result<Option<MarketRow>> {
    let row = sqlx::query_as::<_, MarketRow>(
        r#"
            SELECT
                id,
                market_pda,
                creator,                 
                category,
                symbol,
                end_date_utc,

                market_type,
                comparator,
                bound_lo_1e6,
                bound_hi_1e6,

                initial_liquidity_1e6,
                yes_total_1e6,
                no_total_1e6,
                total_volume_1e6,
                participants,

                price_yes_bp,
                status,
                resolver_pubkey
            FROM market_view
            WHERE market_pda = $1
        "#,
    )
    .bind(market_pda)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn fetch_by_pda(
    pool: &PgPool,
    market_pda: &str,
) -> anyhow::Result<Option<MarketViewRow>> {
    let row = sqlx::query_as::<_, MarketViewRow>(
        r#"
        SELECT id, market_pda, status, price_feed_account, end_date_utc
        FROM market_view
        WHERE market_pda = $1
        LIMIT 1
        "#
    )
    .bind(market_pda)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}