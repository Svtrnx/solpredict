use axum::{extract::{Path, State}, Json};

use crate::{
	state::SharedState, error::AppError,
	handlers::market::types::{MarketDto},
	repo::market as market_repo
};

pub async fn handle(
    State(state): State<SharedState>,
    Path(market_address): Path<String>,
) -> Result<Json<MarketDto>, AppError> {
    let Some(row) = market_repo::find_by_address(&state.db.pool(), &market_address).await
        .map_err(AppError::from)? else {
        return Err(AppError::NotFound);
    };

    Ok(Json(MarketDto::from(row)))
}
