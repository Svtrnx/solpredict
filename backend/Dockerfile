FROM rustlang/rust:nightly AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config clang mold ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs
RUN cargo +nightly -Z unstable-options build --release || true

RUN mkdir -p /onchain/programs/prediction_market
COPY --from=onchain programs/prediction_market/Cargo.toml /onchain/programs/prediction_market/Cargo.toml

COPY . ./
COPY --from=onchain programs/prediction_market /onchain/programs/prediction_market

ARG BIN=solpredict
RUN cargo +nightly -Z unstable-options build --release --bin "$BIN"

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN useradd -u 10001 -m appuser

COPY --from=builder /app/target/release/solpredict /usr/local/bin/app
RUN chmod +x /usr/local/bin/app

ENV RUST_LOG=info
EXPOSE 6570
USER appuser
CMD ["/usr/local/bin/app"]
