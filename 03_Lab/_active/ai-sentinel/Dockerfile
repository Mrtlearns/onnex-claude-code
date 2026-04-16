# Stage 1: Build
FROM rust:latest as builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/

RUN cargo build --release --bin ai-sentinel && \
    strip target/release/ai-sentinel

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates wget && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 65534 nobody-group || true && \
    useradd -u 65534 -g 65534 -s /sbin/nologin -M nobody-user 2>/dev/null || true

COPY --from=builder /build/target/release/ai-sentinel /usr/local/bin/ai-sentinel
COPY config/ /config/

USER 65534:65534
EXPOSE 8080

ENV AI_SENTINEL_CONFIG_DIR=/config
ENV AI_SENTINEL_HOST=0.0.0.0
ENV AI_SENTINEL_PORT=8080

ENTRYPOINT ["/usr/local/bin/ai-sentinel"]
