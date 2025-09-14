use rust_decimal::Decimal;
use sqlx::FromRow;
use anyhow::anyhow;

use crate::handlers::market::create::{CreateMarketRequest, MarketType, MarketCategory, Comparator};

#[derive(Debug, FromRow)]
pub struct MarketRow { pub id: uuid::Uuid }

// Safely convert Option<f64> into Option<Decimal>
fn f64_opt_to_decimal(v: Option<f64>, field: &'static str) -> anyhow::Result<Option<Decimal>> {
    v.map(|x| Decimal::from_f64_retain(x)
        .ok_or_else(|| anyhow!("invalid {} (not representable as Decimal)", field))
    ).transpose()
}

// Map enums into DB-friendly string values
fn market_type_str(mt: MarketType) -> &'static str {
    match mt {
        MarketType::PriceThreshold => "price-threshold",
        MarketType::PriceRange    => "price-range",
    }
}
fn category_str(c: MarketCategory) -> &'static str {
    match c { MarketCategory::Crypto => "crypto" }
}
fn comparator_str(c: Comparator) -> &'static str {
    match c {
        Comparator::Gte   => ">=",
        Comparator::Gt    => ">",
        Comparator::Lte   => "<=",
        Comparator::Lt    => "<",
        Comparator::Eq    => "=",
        Comparator::Empty => "",
    }
}

/// Insert new confirmed market row
pub async fn insert_confirmed(
    pool: &sqlx::PgPool,
    req: &CreateMarketRequest,
    market_pda: &str,
    authority_pubkey: &str,
    tx_sig: &str,
    settled: bool,
) -> anyhow::Result<uuid::Uuid> {
    // Convert request fields into decimals
    let initial_liquidity = f64_opt_to_decimal(Some(req.initial_liquidity), "initial_liquidity")?
        .expect("validated above: must be present");

    let threshold   = f64_opt_to_decimal(req.threshold, "threshold")?;
    let lower_bound = f64_opt_to_decimal(req.lower_bound, "lower_bound")?;
    let upper_bound = f64_opt_to_decimal(req.upper_bound, "upper_bound")?;

    // Insert into markets table and return id
    let rec = sqlx::query_as::<_, MarketRow>(r#"
        INSERT INTO markets (
            market_pda, authority_pubkey, tx_sig, settled,
            market_type, category, end_date_utc, initial_liquidity,
            feed_id, symbol, comparator, threshold, lower_bound, upper_bound
        )
        VALUES ($1,$2,$3,$4,
                $5,$6,$7,$8,
                $9,$10,$11,$12,$13,$14)
        RETURNING id
    "#)
        .bind(market_pda)
        .bind(authority_pubkey)
        .bind(tx_sig)
        .bind(settled)
        .bind(market_type_str(req.market_type))
        .bind(category_str(req.category))
        .bind(req.end_date)
        .bind(initial_liquidity)
        .bind(&req.feed_id)
        .bind(&req.symbol)
        .bind(comparator_str(req.comparator))
        .bind(threshold)
        .bind(lower_bound)
        .bind(upper_bound)
        .fetch_one(pool)
        .await?;

    Ok(rec.id)
}
