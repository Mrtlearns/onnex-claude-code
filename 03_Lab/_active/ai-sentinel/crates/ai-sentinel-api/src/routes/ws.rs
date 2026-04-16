use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    response::IntoResponse,
};
use tokio::time::interval;
use tokio::sync::broadcast::error::RecvError;
use tracing::{debug, warn};

use crate::routes::AppState;

/// GET /ws/telemetry — upgrade to WebSocket and stream TelemetryEvent JSON frames.
/// Each /check request fires one event to all connected clients in real time.
pub async fn ws_telemetry_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.broadcast_tx.subscribe();
    let mut ping_ticker = interval(Duration::from_secs(30));
    ping_ticker.tick().await; // consume the immediate first tick

    loop {
        tokio::select! {
            // New telemetry event from the broadcast channel
            result = rx.recv() => {
                match result {
                    Ok(event) => {
                        match serde_json::to_string(&event) {
                            Ok(json) => {
                                if socket.send(Message::Text(json)).await.is_err() {
                                    debug!("ws/telemetry: client disconnected");
                                    return;
                                }
                            }
                            Err(e) => warn!("ws/telemetry: serialize error: {}", e),
                        }
                    }
                    Err(RecvError::Lagged(n)) => {
                        // Subscriber fell behind under load — skip missed events, continue
                        warn!("ws/telemetry: lagged, dropped {} events", n);
                    }
                    Err(RecvError::Closed) => {
                        debug!("ws/telemetry: broadcast channel closed (server shutdown)");
                        return;
                    }
                }
            }

            // Keepalive ping every 30 seconds
            _ = ping_ticker.tick() => {
                if socket.send(Message::Ping(vec![])).await.is_err() {
                    debug!("ws/telemetry: client disconnected (ping failed)");
                    return;
                }
            }

            // Handle frames from client (Close, Pong — ignore others)
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => {
                        debug!("ws/telemetry: client closed connection");
                        return;
                    }
                    Some(Ok(Message::Pong(_))) => {} // expected response to our Ping
                    Some(Ok(_)) => {}               // binary/text from client — read-only stream
                    Some(Err(e)) => {
                        warn!("ws/telemetry: recv error: {}", e);
                        return;
                    }
                }
            }
        }
    }
}
