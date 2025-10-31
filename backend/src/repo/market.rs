use base64::{Engine as _, engine::general_purpose};
use sqlx::{PgPool, Row, postgres::PgRow};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::handlers::market::types::{Comparator, CreateMarketRequest, MarketCategory, MarketType};

#[derive(Debug, sqlx::FromRow)]
pub struct MarketRowInsert {
    pub id: uuid::Uuid,
}

#[derive(Debug, Clone, Copy)]
pub enum MarketKind {
    Pyth,
    Ai,
}

#[derive(Debug, Clone)]
pub struct AiResolverInput {
    pub ai_topic: String,
    pub ai_description: String,
    pub ai_criteria_md: String,
    pub ai_accepted_sources: Vec<String>,
    pub end_date_utc: Option<chrono::DateTime<chrono::Utc>>,
}

fn market_kind_str(k: MarketKind) -> &'static str {
    match k {
        MarketKind::Pyth => "pyth",
        MarketKind::Ai => "ai",
    }
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
    pub symbol: Option<String>,
    pub market_type: String,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,
    pub status: String,
    pub market_kind: Option<String>,
    pub ai_topic: Option<String>,
}

#[derive(sqlx::FromRow, Debug)]
pub struct MarketRow {
    pub id: uuid::Uuid,
    pub market_pda: String,
    pub creator: String,
    pub category: String,

    pub feed_id: Option<String>,
    pub symbol: Option<String>,

    pub end_date_utc: chrono::DateTime<chrono::Utc>,

    pub market_type: String,
    pub market_kind: Option<String>,
    pub comparator: Option<String>,
    pub bound_lo_1e6: Option<i64>,
    pub bound_hi_1e6: Option<i64>,

    pub initial_liquidity_1e6: Option<i64>,

    pub yes_total_1e6: i64,
    pub no_total_1e6: i64,
    pub total_volume_1e6: i64,
    pub participants: i32,

    pub price_yes_bp: Option<i32>,
    pub status: String,
    pub resolver_pubkey: Option<String>,
    pub ai_topic: Option<String>,
    pub ai_description: Option<String>,
    pub ai_criteria_md: Option<String>,
    pub ai_accepted_sources: Option<Vec<String>>,
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
) -> anyhow::Result<Uuid> {
    let initial_liquidity_1e6 = (req.initial_liquidity * 1_000_000.0).round() as i64;

    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO markets (
          market_kind,
          market_pda, authority_pubkey, tx_sig_create,
          category, symbol,
          market_type, comparator, bound_lo_1e6, bound_hi_1e6, end_date_utc,
          feed_id, price_feed_account, mint,
          initial_liquidity_1e6
        )
        VALUES ($1,
                $2,$3,$4,
                $5,$6,
                $7,$8,$9,$10,$11::timestamptz,
                $12,$13,$14,
                $15)
        RETURNING id
        "#,
        market_kind_str(MarketKind::Pyth),
        market_pda,
        authority_pubkey,
        tx_sig_create,
        category_str(req.category),
        req.symbol,
        market_type_str(req.market_type),
        comparator_str(req.comparator),
        bound_lo_1e6,
        bound_hi_1e6,
        req.end_date,
        req.feed_id,
        price_feed_account,
        mint,
        initial_liquidity_1e6
    )
    .fetch_one(pool)
    .await?;

    Ok(id)
}

pub async fn insert_confirmed_market_ai(
    pool: &sqlx::PgPool,
    market_pda: &str,
    authority_pubkey: &str,
    tx_sig_create: &str,
    category_text: &str,
    end_date_utc: OffsetDateTime,
    ai_job_hash: &str,
    ai_proposal_id: &str,
    ai_topic: &str,
    ai_description: &str,
    ai_criteria_md: &str,
    ai_accepted_sources: &Vec<String>,
    ai_short_text: &str,
) -> anyhow::Result<Uuid> {
    let market_type = "multi";
    let symbol = "AI";

    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO markets (
          market_kind,
          market_type,
          market_pda, authority_pubkey, tx_sig_create,
          category, end_date_utc,
          ai_job_hash, ai_proposal_id, ai_topic, ai_description, ai_criteria_md, ai_accepted_sources, ai_short_text,
          symbol
        )
        VALUES (
          $1,
          $2,
          $3, $4, $5,
          $6, $7::timestamptz,
          $8, $9, $10, $11, $12, $13, $14,
          $15
        )
        RETURNING id
        "#,
        market_kind_str(MarketKind::Ai),
        market_type,
        market_pda,
        authority_pubkey,
        tx_sig_create,
        category_text,
        end_date_utc,
        ai_job_hash,
        ai_proposal_id,
        ai_topic,
        ai_description,
        ai_criteria_md,
        serde_json::Value::from(ai_accepted_sources.clone()),
        ai_short_text,
        symbol
    )
    .fetch_one(pool)
    .await?;

    Ok(id)
}


pub async fn upsert_initial_state(
    pool: &sqlx::PgPool,
    market_id: Uuid,
    yes_total_1e6: i64,
    no_total_1e6: i64,
    participants: i32,
) -> anyhow::Result<()> {
    tracing::info!(
        "Upserting initial market_state: yes_total_1e6={} no_total_1e6={} participants={}",
        yes_total_1e6, no_total_1e6, participants
    );

    let total = yes_total_1e6 + no_total_1e6;

    sqlx::query!(
        r#"
        INSERT INTO market_state (
          market_id, yes_total_1e6, no_total_1e6, total_volume_1e6, participants
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (market_id) DO UPDATE
        SET
          yes_total_1e6     = EXCLUDED.yes_total_1e6,
          no_total_1e6      = EXCLUDED.no_total_1e6,
          total_volume_1e6  = EXCLUDED.total_volume_1e6,
          participants      = EXCLUDED.participants,
          updated_at        = now()
        "#,
        market_id,
        yes_total_1e6,
        no_total_1e6,
        total,
        participants
    )
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
    statuses: Option<&[&str]>,
) -> Result<MarketsPage> {
    //  sort key normalization 
    #[derive(Copy, Clone, Debug)]
    enum SortKey { Updated, Volume, Participants, Ending, Status }

    let sk = match sort.map(|s| s.to_ascii_lowercase()) {
        Some(ref s) if s == "volume"       => SortKey::Volume,
        Some(ref s) if s == "participants" => SortKey::Participants,
        Some(ref s) if s == "ending"       => SortKey::Ending,
        Some(ref s) if s == "status"       => SortKey::Status,
        _                                  => SortKey::Updated,
    };

    // sort plans 
    struct Plan { col: &'static str, asc: bool, cmp: &'static str }
    let plan = match sk {
        SortKey::Updated      => Plan { col: "updated_at",       asc: false, cmp: "<" },
        SortKey::Volume       => Plan { col: "total_volume_1e6", asc: false, cmp: "<" },
        SortKey::Participants => Plan { col: "participants",     asc: false, cmp: "<" },
        SortKey::Ending       => Plan { col: "end_date_utc",     asc: true,  cmp: ">" },
        SortKey::Status       => Plan { col: "status_rank",      asc: true,  cmp: ">" },
    };

    //  cursor decode 
    enum CurVal {
        Dt(DateTime<Utc>),
        I64(i64),
        Status { rank: i32, at: DateTime<Utc> },
    }

    let (cur_val, cur_id): (Option<CurVal>, Option<Uuid>) = if let Some(c) = cursor {
        let raw = general_purpose::STANDARD.decode(c)?;
        let s = String::from_utf8(raw)?;
        match sk {
            SortKey::Updated | SortKey::Ending => {
                let (a, b) = s.split_once('|').unwrap_or(("", ""));
                (a.parse::<DateTime<Utc>>().ok().map(CurVal::Dt), Uuid::parse_str(b).ok())
            }
            SortKey::Volume | SortKey::Participants => {
                let (a, b) = s.split_once('|').unwrap_or(("", ""));
                (a.parse::<i64>().ok().map(CurVal::I64), Uuid::parse_str(b).ok())
            }
            SortKey::Status => {
                let mut it = s.split('|');
                let r  = it.next().unwrap_or("").parse::<i32>().ok();
                let at = it.next().unwrap_or("").parse::<DateTime<Utc>>().ok();
                let id = Uuid::parse_str(it.next().unwrap_or("")).ok();
                match (r, at) {
                    (Some(rank), Some(dt)) => (Some(CurVal::Status { rank, at: dt }), id),
                    _ => (None, id),
                }
            }
        }
    } else { (None, None) };

    const ALLOWED: &[&str] = &["active","awaiting_resolve","settled_yes","settled_no","void"];
    let mut status_vec: Vec<&str> = match statuses {
        Some(st) => st.iter().copied().filter(|s| ALLOWED.contains(s)).collect(),
        None     => vec!["active","awaiting_resolve"], // default "open"
    };
    if status_vec.is_empty() {
        status_vec = vec!["active","awaiting_resolve"];
    }

    //  query build 
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(r#"
        WITH ranked AS (
          SELECT
            id, market_pda, category, total_volume_1e6, participants, price_yes_bp,
            end_date_utc, updated_at, symbol, market_type, comparator,
            bound_lo_1e6, bound_hi_1e6, status, market_kind, ai_topic,
            CASE status
              WHEN 'active'           THEN 1
              WHEN 'awaiting_resolve' THEN 2
              WHEN 'settled_yes'      THEN 3
              WHEN 'settled_no'       THEN 4
              WHEN 'void'             THEN 5
              ELSE 9
            END AS status_rank
          FROM market_view
          WHERE 1=1
    "#);

    if let Some(cat) = category {
        qb.push(" AND category = ").push_bind(cat);
    }

    qb.push(" AND status = ANY(")
      .push_bind(status_vec)
      .push(") ) SELECT * FROM ranked WHERE 1=1 ");

    //  keyset for current sort 
    if let (Some(v), Some(cid)) = (&cur_val, cur_id) {
        match (sk, v) {
            (SortKey::Updated,      CurVal::Dt(dt))  |
            (SortKey::Ending,       CurVal::Dt(dt))  => {
                qb.push(" AND (").push(plan.col).push(", id) ")
                  .push(plan.cmp).push(" (").push_bind(dt).push(", ").push_bind(cid).push(") ");
            }
            (SortKey::Volume,       CurVal::I64(i))  |
            (SortKey::Participants, CurVal::I64(i))  => {
                qb.push(" AND (").push(plan.col).push(", id) ")
                  .push(plan.cmp).push(" (").push_bind(i).push(", ").push_bind(cid).push(") ");
            }
            (SortKey::Status, CurVal::Status { rank, at }) => {
                qb.push(" AND ( status_rank > ")
                  .push_bind(*rank)
                  .push(" OR (status_rank = ")
                  .push_bind(*rank)
                  .push(" AND updated_at < ")
                  .push_bind(*at)
                  .push(") OR (status_rank = ")
                  .push_bind(*rank)
                  .push(" AND updated_at = ")
                  .push_bind(*at)
                  .push(" AND id < ")
                  .push_bind(cid)
                  .push(") ) ");
            }
            _ => {}
        }
    }

    match sk {
        SortKey::Status => {
            qb.push(" ORDER BY status_rank ASC, updated_at DESC, id DESC ");
        }
        _ => {
            qb.push(" ORDER BY ").push(plan.col);
            if plan.asc { qb.push(" ASC, id ASC "); }
            else        { qb.push(" DESC, id DESC "); }
        }
    }

    qb.push(" LIMIT ").push_bind(limit + 1);

    let rows: Vec<PgRow> = qb.build().fetch_all(pool).await?;

    //  map rows 
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
            status: r.try_get("status")?,
            market_kind: r.try_get("market_kind")?,
            ai_topic: r.try_get("ai_topic")?,
        });
    }

    //  next cursor 
    let next_cursor = if rows.len() as i64 > limit {
        if let Some(last) = out.last() {
            let enc = match sk {
                SortKey::Updated      => format!("{}|{}", last.updated_at.to_rfc3339(), last.id),
                SortKey::Ending       => format!("{}|{}", last.end_date_utc.to_rfc3339(), last.id),
                SortKey::Volume       => format!("{}|{}", last.total_volume_1e6, last.id),
                SortKey::Participants => format!("{}|{}", last.participants, last.id),
                SortKey::Status       => {
                    let rank = match last.status.as_str() {
                        "active"           => 1,
                        "awaiting_resolve" => 2,
                        "settled_yes"      => 3,
                        "settled_no"       => 4,
                        "void"             => 5,
                        _                  => 9,
                    };
                    format!("{}|{}|{}", rank, last.updated_at.to_rfc3339(), last.id)
                }
            };
            Some(general_purpose::STANDARD.encode(enc.as_bytes()))
        } else { None }
    } else { None };

    Ok(MarketsPage { items: out, next_cursor })
}


pub async fn find_by_address(pool: &PgPool, market_pda: &str) -> anyhow::Result<Option<MarketRow>> {
    #[derive(sqlx::FromRow)]
    struct MarketRowQuery {
        id: uuid::Uuid,
        market_pda: String,
        creator: String,
        category: String,
        feed_id: Option<String>,
        symbol: Option<String>,
        end_date_utc: chrono::DateTime<chrono::Utc>,
        market_type: String,
        market_kind: Option<String>,
        comparator: Option<String>,
        bound_lo_1e6: Option<i64>,
        bound_hi_1e6: Option<i64>,
        initial_liquidity_1e6: Option<i64>,
        yes_total_1e6: i64,
        no_total_1e6: i64,
        total_volume_1e6: i64,
        participants: i32,
        price_yes_bp: Option<i32>,
        status: String,
        resolver_pubkey: Option<String>,
        ai_topic: Option<String>,
        ai_description: Option<String>,
        ai_criteria_md: Option<String>,
        ai_accepted_sources: Option<sqlx::types::Json<Vec<String>>>,
    }

    let row = sqlx::query_as!(
        MarketRowQuery,
        r#"
        SELECT
            id                          AS "id!: uuid::Uuid",
            market_pda                  AS "market_pda!",
            creator                     AS "creator!",
            category                    AS "category!",
            symbol                      AS "symbol?",
            feed_id                     AS "feed_id?",
            end_date_utc                AS "end_date_utc!: chrono::DateTime<chrono::Utc>",

            market_type                 AS "market_type!",
            market_kind                 AS "market_kind?",
            comparator                  AS "comparator?",
            bound_lo_1e6                AS "bound_lo_1e6?: i64",
            bound_hi_1e6                AS "bound_hi_1e6?: i64",

            initial_liquidity_1e6       AS "initial_liquidity_1e6?: i64",
            yes_total_1e6               AS "yes_total_1e6!: i64",
            no_total_1e6                AS "no_total_1e6!: i64",
            total_volume_1e6            AS "total_volume_1e6!: i64",
            participants                AS "participants!: i32",

            price_yes_bp                AS "price_yes_bp?: i32",
            status                      AS "status!",
            resolver_pubkey             AS "resolver_pubkey?",
            ai_topic                    AS "ai_topic?",
            ai_description              AS "ai_description?",
            ai_criteria_md              AS "ai_criteria_md?",
            ai_accepted_sources         AS "ai_accepted_sources?: sqlx::types::Json<Vec<String>>"
        FROM market_view
        WHERE market_pda = $1
        "#,
        market_pda
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| MarketRow {
        id: r.id,
        market_pda: r.market_pda,
        creator: r.creator,
        category: r.category,
        feed_id: r.feed_id,
        symbol: r.symbol,
        end_date_utc: r.end_date_utc,
        market_type: r.market_type,
        market_kind: r.market_kind,
        comparator: r.comparator,
        bound_lo_1e6: r.bound_lo_1e6,
        bound_hi_1e6: r.bound_hi_1e6,
        initial_liquidity_1e6: r.initial_liquidity_1e6,
        yes_total_1e6: r.yes_total_1e6,
        no_total_1e6: r.no_total_1e6,
        total_volume_1e6: r.total_volume_1e6,
        participants: r.participants,
        price_yes_bp: r.price_yes_bp,
        status: r.status,
        resolver_pubkey: r.resolver_pubkey,
        ai_topic: r.ai_topic,
        ai_description: r.ai_description,
        ai_criteria_md: r.ai_criteria_md,
        ai_accepted_sources: r.ai_accepted_sources.map(|j| j.0),
    }))
}

pub async fn fetch_by_pda(
    pool: &PgPool,
    market_pda: &str,
) -> anyhow::Result<Option<MarketViewRow>> {
    let row = sqlx::query_as!(
        MarketViewRow,
        r#"
        SELECT
            id                                  AS "id!: uuid::Uuid",
            market_pda                          AS "market_pda!",
            status                              AS "status!",
            COALESCE(price_feed_account, '')    AS "price_feed_account!",
            end_date_utc                        AS "end_date_utc?: chrono::DateTime<chrono::Utc>"
        FROM market_view
        WHERE market_pda = $1
        LIMIT 1
        "#,
        market_pda
    )
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


pub async fn fetch_ai_resolver_input_by_pda(pool: &PgPool, market_pda: &str) -> Result<Option<AiResolverInput>> {
    let row = sqlx::query!(
        r#"
        SELECT
          ai_topic                        AS "ai_topic?",
          ai_description                  AS "ai_description?",
          ai_criteria_md                  AS "ai_criteria_md?",
          ai_accepted_sources             AS "ai_accepted_sources?: sqlx::types::Json<Vec<String>>",
          end_date_utc                    AS "end_date_utc?: chrono::DateTime<chrono::Utc>"
        FROM market_view
        WHERE market_pda = $1
        LIMIT 1
        "#,
        market_pda
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| AiResolverInput {
        ai_topic: r.ai_topic.unwrap_or_default(),
        ai_description: r.ai_description.unwrap_or_default(),
        ai_criteria_md: r.ai_criteria_md.unwrap_or_default(),
        ai_accepted_sources: r.ai_accepted_sources.map(|j| j.0).unwrap_or_default(),
        end_date_utc: r.end_date_utc,
    }))
}