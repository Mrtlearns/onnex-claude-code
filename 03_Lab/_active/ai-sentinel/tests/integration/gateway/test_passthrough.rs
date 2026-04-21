/// Integration test: clean LLM request passes through gateway.
///
/// Requires:
/// - GATEWAY env var pointing to a running gateway (default: http://localhost:8080)
/// - ANTHROPIC_API_KEY env var with a valid key
///
/// Run with: cargo test -p ai-sentinel-api --test test_passthrough -- --nocapture
#[tokio::test]
#[ignore = "requires live gateway and ANTHROPIC_API_KEY"]
async fn clean_llm_request_passes_through() {
    let gateway = std::env::var("GATEWAY").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let api_key = std::env::var("ANTHROPIC_API_KEY").expect("ANTHROPIC_API_KEY must be set");

    let proxy = reqwest::Proxy::https(&gateway).expect("invalid gateway URL");
    let client = reqwest::Client::builder()
        .proxy(proxy)
        .build()
        .expect("failed to build reqwest client");

    let payload = serde_json::json!({
        "model": "claude-haiku-4-5-20251001",
        "messages": [{"role": "user", "content": "Say hello"}],
        "max_tokens": 10
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status().as_u16(), 200, "expected HTTP 200 from upstream");

    let body: serde_json::Value = resp.json().await.expect("response is not JSON");
    assert!(
        body["content"][0]["text"].is_string(),
        "expected text in response, got: {body}"
    );
}
