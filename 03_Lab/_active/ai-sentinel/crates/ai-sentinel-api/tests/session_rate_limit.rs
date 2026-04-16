use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use ai_sentinel_core::{AppConfig, CheckRequest, CheckStatus, CallerContext, Direction, LayerContext, Pipeline, SessionStore};
use ai_sentinel_feed::{LiveSignatures, SignatureSet};
use ai_sentinel_layers::{L5Sandbox};
use ai_sentinel_store::MemoryStore;

fn make_l5_only_pipeline(max_actions: u64) -> (Pipeline, Arc<AtomicBool>, Arc<MemoryStore>) {
    let mut config = AppConfig::default();
    config.rate_max_actions_per_hour = max_actions;
    let config = Arc::new(config);
    let e_stop = Arc::new(AtomicBool::new(false));
    let store = Arc::new(MemoryStore::default());

    let l5 = L5Sandbox::new(&config, e_stop.clone());
    let pipeline = Pipeline::new(vec![Arc::new(l5)]);
    (pipeline, e_stop, store)
}

fn make_req_with_session(session_id: &str) -> CheckRequest {
    CheckRequest {
        direction: Direction::Ingress,
        payload: serde_json::json!({ "content": "test" }),
        session_id: Some(session_id.to_string()),
        caller_context: CallerContext {
            caller_id: "rate-test-caller".to_string(),
            ..Default::default()
        },
        tool_manifest: None,
        config_override: None,
    }
}

#[tokio::test]
async fn test_rate_limit_1001st_request() {
    let (pipeline, _, store) = make_l5_only_pipeline(1000);
    let session_id = "rate-limit-test";

    // Send 1000 requests — all should pass
    for i in 0..1000 {
        let req = make_req_with_session(session_id);
        let mut ctx = LayerContext::new(format!("req-{}", i));

        // Attach session
        let handle = store.get(session_id, "rate-test-caller").await.unwrap();
        ctx.session = Some(handle);

        let resp = pipeline.run(req, &mut ctx).await;
        assert_eq!(resp.status, CheckStatus::Pass,
            "request {} should pass, got {:?}", i, resp.reject);
    }

    // 1001st request — should be rate limited
    let req = make_req_with_session(session_id);
    let mut ctx = LayerContext::new("req-1001".to_string());
    let handle = store.get(session_id, "rate-test-caller").await.unwrap();
    ctx.session = Some(handle);

    let resp = pipeline.run(req, &mut ctx).await;
    assert_eq!(resp.status, CheckStatus::Reject,
        "1001st request should be rejected by rate limiter");
    assert_eq!(resp.reject.unwrap().code, "RATE_LIMIT");
}

#[tokio::test]
async fn test_estop_blocks_all() {
    let (pipeline, e_stop, store) = make_l5_only_pipeline(1000);
    let session_id = "estop-test";

    // Activate e-stop
    e_stop.store(true, std::sync::atomic::Ordering::SeqCst);

    let req = make_req_with_session(session_id);
    let mut ctx = LayerContext::new("estop-req".to_string());
    let handle = store.get(session_id, "estop-caller").await.unwrap();
    ctx.session = Some(handle);

    let resp = pipeline.run(req, &mut ctx).await;
    assert_eq!(resp.status, CheckStatus::Reject);
    assert_eq!(resp.reject.unwrap().code, "ESTOP");
}
