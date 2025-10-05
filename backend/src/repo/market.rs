use base64::{Engine as _, engine::general_purpose};
use sqlx::{PgPool, Row, postgres::PgRow};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::handlers::market::types::{Comparator, CreateMarketRequest, MarketCategory, MarketType};

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

#[derive(Debug, Clone)]
pub struct ResolveSnapshot {
    pub settled: bool,                   
    pub winning_side: Option<i16>, 
    pub resolved_price_1e6: Option<i64>,
    pub payout_pool_1e6: Option<i64>,
    pub resolver_pubkey: String,
    pub tx_sig_resolve: String,
}

#[derive(Debug, Clone)]
pub struct ConfirmResolveRow {
    pub market_id: String,
    pub status: String,
    pub winning_side: Option<i16>,
    pub resolved_price_1e6: Option<i64>,
    pub payout_pool_1e6: Option<i64>,
    pub tx_sig_resolve: Option<String>,
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
    tracing::info!("Upserting initial market_state");
    tracing::info!("yes_total_1e6={} no_total_1e6={} participants={}", yes_total_1e6, no_total_1e6, participants);
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
    sort: Option<&str>,
) -> Result<MarketsPage> {
    // Normalize sort key to a safe enum
    enum SortKey {
        Updated,
        Volume,
        Participants,
        Ending,
    }
    let sk = match sort.map(|s| s.to_ascii_lowercase()) {
        Some(ref s) if s == "volume" => SortKey::Volume,
        Some(ref s) if s == "participants" => SortKey::Participants,
        Some(ref s) if s == "ending" => SortKey::Ending,
        _ => SortKey::Updated,
    };

    // Column, direction and comparison operator for keyset pagination
    struct Plan {
        col: &'static str,
        asc: bool,
        cmp: &'static str,
    }
    let plan = match sk {
        SortKey::Updated => Plan {
            col: "updated_at",
            asc: false,
            cmp: "<",
        },
        SortKey::Volume => Plan {
            col: "total_volume_1e6",
            asc: false,
            cmp: "<",
        },
        SortKey::Participants => Plan {
            col: "participants",
            asc: false,
            cmp: "<",
        },
        SortKey::Ending => Plan {
            col: "end_date_utc",
            asc: true,
            cmp: ">",
        },
    };
    // Decode cursor "{key}|{uuid}" and parse key based on current sort
    enum CurVal {
        Dt(DateTime<Utc>),
        I64(i64),
    }
    let (cur_val, cur_id): (Option<CurVal>, Option<Uuid>) = if let Some(c) = cursor {
        let raw = general_purpose::STANDARD.decode(c)?;
        let s = String::from_utf8(raw)?;
        let (a, b) = s.split_once('|').unwrap_or(("", ""));
        let id = Uuid::parse_str(b).ok();
        let v = match sk {
            SortKey::Updated | SortKey::Ending => a.parse::<DateTime<Utc>>().ok().map(CurVal::Dt),
            SortKey::Volume | SortKey::Participants => a.parse::<i64>().ok().map(CurVal::I64),
        };
        (v, id)
    } else {
        (None, None)
    };

    // Build query with safe bindings
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        r#"
        SELECT
          id, market_pda, category, total_volume_1e6, participants, price_yes_bp,
          end_date_utc, updated_at, symbol, market_type, comparator,
          bound_lo_1e6, bound_hi_1e6
        FROM market_view
        WHERE 1=1
        "#,
    );

    if let Some(cat) = category {
        qb.push(" AND category = ").push_bind(cat);
    }

    if let (Some(v), Some(cid)) = (&cur_val, cur_id) {
        qb.push(" AND (")
            .push(plan.col)
            .push(", id) ")
            .push(plan.cmp)
            .push(" (");
        match v {
            CurVal::Dt(dt) => qb.push_bind(dt),
            CurVal::I64(i) => qb.push_bind(i),
        };
        qb.push(", ").push_bind(cid).push(") ");
    }

    qb.push(" ORDER BY ").push(plan.col);

    if plan.asc {
        qb.push(" ASC, id ASC ");
    } else {
        qb.push(" DESC, id DESC ");
    }

    qb.push(" LIMIT ").push_bind(limit + 1);

    let rows: Vec<PgRow> = qb.build().fetch_all(pool).await?;

    // Map rows into output
    let mut out = Vec::with_capacity(rows.len().min(limit as usize));
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

    // Encode next cursor using the same sort key
    let next_cursor = if rows.len() as i64 > limit {
        if let Some(last) = out.last() {
            let key_str = match sk {
                SortKey::Updated => last.updated_at.to_rfc3339(),
                SortKey::Ending => last.end_date_utc.to_rfc3339(),
                SortKey::Volume => last.total_volume_1e6.to_string(),
                SortKey::Participants => last.participants.to_string(),
            };
            let s = format!("{}|{}", key_str, last.id);
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
        "#,
    )
    .bind(market_pda)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn confirm_resolve_persist(
    pool: &PgPool,
    market_id: Uuid,
    snap: &ResolveSnapshot,
) -> anyhow::Result<ConfirmResolveRow> {

    let mut tx = pool.begin().await.context("begin tx failed")?;

    // UPSERT market_state
    sqlx::query(
        r#"
        INSERT INTO market_state (
            market_id, settled, winning_side, resolved_price_1e6, payout_pool_1e6,
            resolver_pubkey, tx_sig_resolve, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (market_id) DO UPDATE SET
            settled            = EXCLUDED.settled,
            winning_side       = EXCLUDED.winning_side,
            resolved_price_1e6 = EXCLUDED.resolved_price_1e6,
            payout_pool_1e6    = EXCLUDED.payout_pool_1e6,
            resolver_pubkey    = EXCLUDED.resolver_pubkey,
            tx_sig_resolve     = EXCLUDED.tx_sig_resolve,
            updated_at         = now()
        "#,
    )
    .bind(market_id)
    .bind(snap.settled)
    .bind(snap.winning_side)
    .bind(snap.resolved_price_1e6)
    .bind(snap.payout_pool_1e6)
    .bind(&snap.resolver_pubkey)
    .bind(&snap.tx_sig_resolve)
    .execute(&mut *tx)
    .await
    .context("upsert market_state failed")?;

    // touch markets.updated_at
    sqlx::query(r#"UPDATE markets SET updated_at = now() WHERE id = $1"#)
        .bind(market_id)
        .execute(&mut *tx)
        .await
        .context("touch markets.updated_at failed")?;

    // SELECT from market_view
    let r = sqlx::query(
        r#"
        SELECT
            id::text        AS market_id,
            status,
            winning_side,
            resolved_price_1e6,
            payout_pool_1e6,
            tx_sig_resolve
        FROM market_view
        WHERE id = $1
        "#,
    )
    .bind(market_id)
    .fetch_one(&mut *tx)
    .await
    .context("select from market_view failed")?;

    tx.commit().await.context("commit tx failed")?;

    Ok(ConfirmResolveRow {
        market_id: r.try_get::<String, _>("market_id")?,
        status: r.try_get::<String, _>("status")?,
        winning_side: r.try_get::<Option<i16>, _>("winning_side")?,
        resolved_price_1e6: r.try_get::<Option<i64>, _>("resolved_price_1e6")?,
        payout_pool_1e6: r.try_get::<Option<i64>, _>("payout_pool_1e6")?,
        tx_sig_resolve: r.try_get::<Option<String>, _>("tx_sig_resolve")?,
    })
}
