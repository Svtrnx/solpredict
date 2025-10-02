use axum::{
    Router,
    http::{HeaderValue, Method, header},
    middleware,
    routing::{get, post},
};
use std::time::Duration;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::{
    cors::CorsLayer,
    timeout::TimeoutLayer,
    trace::{
        TraceLayer, DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse,
    },
    classify::ServerErrorsFailureClass,
    request_id::{MakeRequestUuid, SetRequestIdLayer, PropagateRequestIdLayer},
};
use tracing::{Level, Span};

use crate::middleware::auth::require_user;
use crate::{handlers, state::SharedState};

fn log_failure(class: ServerErrorsFailureClass, latency: Duration, _span: &Span) {
    tracing::error!(%class, ?latency, "request failed");
}

pub fn build(state: SharedState) -> Router {
    // --- rate limit ---
    let governor = GovernorConfigBuilder::default()
        .per_second(1)
        .burst_size(15)
        .finish()
        .unwrap();

    // --- CORS ---
    let cors = CorsLayer::new()
        .allow_origin(HeaderValue::from_static("http://localhost:3000"))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(true);

    // --- public routes ---
    let public_v1 = Router::new()
        .route("/auth/nonce", get(handlers::siws::nonce::get_nonce))
        .route("/auth/verify", post(handlers::siws::verify::verify))
        .route("/profile/{wallet}", get(handlers::profile::profile::wallet_overview_public))
        .route("/auth/me", get(handlers::me::me))
        .route("/profile/bets", get(handlers::profile::bets::list_bets_public))
        .merge(handlers::market::public_routes());
    
    // --- protected routes ---
    let protected_v1 = Router::new()
        .route("/health", get(handlers::health::health))
        .route("/ai/probability", get(handlers::ai::get_probability))
        .route("/airdrop/usdc", post(handlers::airdrop::usdc_airdrop_once))
        .route("/admin/metadata", post(handlers::metadata::set_token_metadata))
        .route("/profile/overview", get(handlers::profile::profile::wallet_overview))
        .merge(handlers::market::protected_routes())
        .route_layer(middleware::from_fn_with_state(state.clone(), require_user));

    Router::new()
        .route("/", get(handlers::root::index))
        .nest("/v1", public_v1.merge(protected_v1))
        .with_state(state)
        .layer(TimeoutLayer::new(Duration::from_secs(10)))
        .layer(GovernorLayer::new(governor))
        .layer(cors)
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(
                    DefaultMakeSpan::new()
                        .level(Level::INFO)
                        // .include_headers(true),
                )
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO))
                .on_failure(log_failure),
        )
        .layer(PropagateRequestIdLayer::x_request_id())
}
