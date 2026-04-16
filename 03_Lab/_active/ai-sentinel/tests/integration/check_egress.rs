use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use ai_sentinel_core::{AppConfig, CheckRequest, CheckStatus, CallerContext, Direction, LayerContext, Pipeline};
use ai_sentinel_feed::{LiveSignatures, SignatureSet};
use ai_sentinel_layers::{L1Sanitization, L2Auth, L2Mcp, L2Threat, L2Trust, L3Intent, L4Tools, L5Sandbox, L6Output};

fn make_pipeline() -> Pipeline {
    let config = Arc::new(AppConfig::default());
    let sigs = LiveSignatures::new(SignatureSet::default());
    let e_stop = Arc::new(AtomicBool::new(false));

    let l1 = L1Sanitization::new(&config).unwrap();
    let l2_auth = L2Auth::new(&config);
    let l2_trust = L2Trust::new(&config);
    let l2_threat = L2Threat::new(sigs.clone());
    let l2_mcp = L2Mcp::new();
    let l3 = L3Intent::new();
    let l4 = L4Tools::new(&config, sigs.clone()).unwrap();
    let l5 = L5Sandbox::new(&config, e_stop);
    let l6 = L6Output::new();

    Pipeline::new(vec![
        Arc::new(l1),
        Arc::new(l2_auth),
        Arc::new(l2_trust),
        Arc::new(l2_threat),
        Arc::new(l2_mcp),
        Arc::new(l3),
        Arc::new(l4),
        Arc::new(l5),
        Arc::new(l6),
    ])
}

fn egress_req(payload: serde_json::Value) -> CheckRequest {
    CheckRequest {
        direction: Direction::Egress,
        payload,
        session_id: Some("egress-session".to_string()),
        caller_context: CallerContext {
            caller_id: "test-caller".to_string(),
            ..Default::default()
        },
        tool_manifest: None,
        config_override: None,
    }
}

#[tokio::test]
async fn test_clean_egress_passes() {
    let pipeline = make_pipeline();
    let req = egress_req(serde_json::json!({
        "content": "The capital of France is Paris."
    }));
    let mut ctx = LayerContext::new("test-egress-clean".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    assert_eq!(resp.status, CheckStatus::Pass, "clean egress should pass: {:?}", resp.reject);
}

#[tokio::test]
async fn test_egress_skips_ingress_layers() {
    // Egress direction should skip L1 (injection check) — injection-like text in response should pass
    let pipeline = make_pipeline();
    let req = egress_req(serde_json::json!({
        "content": "Note: Ignore all previous instructions is a known injection attempt."
    }));
    let mut ctx = LayerContext::new("test-egress-skip".to_string());
    let resp = pipeline.run(req, &mut ctx).await;

    // L1 applies to ingress only, so egress with injection-like text should pass
    assert_eq!(resp.status, CheckStatus::Pass, "egress should skip L1 injection check");
    // L6 stub also applies_to false so no SSRF check yet
}
