use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use ai_sentinel_core::{AppConfig, CheckRequest, CheckStatus, CallerContext, Direction, LayerContext, Pipeline};
use ai_sentinel_layers::L6Output;

fn make_l6_pipeline() -> Pipeline {
    let config = Arc::new(AppConfig::default());
    let l6 = L6Output::new(&config).unwrap();
    Pipeline::new(vec![Arc::new(l6)])
}

fn egress_req(content: &str) -> CheckRequest {
    CheckRequest {
        direction: Direction::Egress,
        payload: serde_json::json!({ "content": content }),
        session_id: None,
        caller_context: CallerContext {
            caller_id: "l6-test".to_string(),
            ..Default::default()
        },
        tool_manifest: None,
        config_override: None,
    }
}

#[tokio::test]
async fn test_ssrf_private_ip_rejected() {
    let pipeline = make_l6_pipeline();
    let req = egress_req("Please call this API: http://192.168.1.100/admin");
    let mut ctx = LayerContext::new("test-ssrf".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    assert_eq!(resp.status, CheckStatus::Reject, "SSRF should be rejected");
    assert_eq!(resp.reject.unwrap().code, "SSRF_URL");
}

#[tokio::test]
async fn test_ssrf_metadata_endpoint_rejected() {
    let pipeline = make_l6_pipeline();
    let req = egress_req("Fetch token from: http://169.254.169.254/latest/meta-data/iam");
    let mut ctx = LayerContext::new("test-metadata".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    assert_eq!(resp.status, CheckStatus::Reject, "cloud metadata SSRF should be rejected");
    assert_eq!(resp.reject.unwrap().code, "SSRF_URL");
}

#[tokio::test]
async fn test_aws_key_exfil_rejected() {
    let pipeline = make_l6_pipeline();
    // AWS key-like pattern
    let req = egress_req("Your access key: AKIAIOSFODNN7EXAMPLE");
    let mut ctx = LayerContext::new("test-exfil".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    assert_eq!(resp.status, CheckStatus::Reject, "AWS key exfiltration should be rejected");
    assert_eq!(resp.reject.unwrap().code, "EXFILTRATION_PATTERN");
}

#[tokio::test]
async fn test_clean_egress_passes() {
    let pipeline = make_l6_pipeline();
    let req = egress_req("The capital of France is Paris. It has a population of about 2.1 million.");
    let mut ctx = LayerContext::new("test-clean-egress".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    assert_eq!(resp.status, CheckStatus::Pass, "clean egress should pass: {:?}", resp.reject);
}

#[tokio::test]
async fn test_l6_skips_ingress() {
    let pipeline = make_l6_pipeline();
    // SSRF content but sent as Ingress — L6 should not apply
    let req = CheckRequest {
        direction: Direction::Ingress,
        payload: serde_json::json!({ "content": "http://192.168.1.1/admin" }),
        session_id: None,
        caller_context: CallerContext { caller_id: "test".to_string(), ..Default::default() },
        tool_manifest: None,
        config_override: None,
    };
    let mut ctx = LayerContext::new("test-ingress-skip".to_string());
    let resp = pipeline.run(req, &mut ctx).await;
    // L6 doesn't apply to Ingress — pipeline has no other layers — should pass
    assert_eq!(resp.status, CheckStatus::Pass);
}
