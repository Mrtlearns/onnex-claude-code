/// Integration test: non-LLM HTTPS traffic (github.com) tunnels through without decryption.
///
/// Requires GATEWAY env var.
#[tokio::test]
#[ignore = "requires live gateway with internet access"]
async fn github_tunnels_without_decryption() {
    let gateway = std::env::var("GATEWAY").unwrap_or_else(|_| "http://localhost:8080".to_string());

    let proxy = reqwest::Proxy::https(&gateway).expect("invalid gateway URL");
    let client = reqwest::Client::builder()
        .proxy(proxy)
        .build()
        .expect("failed to build reqwest client");

    let resp = client
        .get("https://github.com")
        .send()
        .await
        .expect("request to github.com failed");

    let status = resp.status().as_u16();
    assert!(
        [200, 301, 302].contains(&status),
        "expected 200/301/302 from github.com, got {status}"
    );
}
