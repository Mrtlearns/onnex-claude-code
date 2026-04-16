use ai_sentinel_feed::{LiveSignatures, SignatureSet};

#[tokio::test]
async fn test_feed_hotswap_zero_restart() {
    // Start with empty signatures
    let live = LiveSignatures::new(SignatureSet::default());
    assert!(!live.get().matches_threat("ATTACK_PATTERN_XYZ_001"));

    // Hot-swap: load a new signature
    let new_set = SignatureSet::new(
        vec!["ATTACK_PATTERN_XYZ_001".to_string()],
        vec![],
        vec!["TEST-CVE-001".to_string()],
    );
    live.swap(new_set);

    // New signature is immediately active
    assert!(live.get().matches_threat("ATTACK_PATTERN_XYZ_001"),
        "new signature should match after hot-swap");

    // Swap again to remove the pattern
    let empty_set = SignatureSet::default();
    live.swap(empty_set);

    // Pattern no longer matches
    assert!(!live.get().matches_threat("ATTACK_PATTERN_XYZ_001"),
        "pattern should not match after second hot-swap");
}

#[tokio::test]
async fn test_signatures_stats() {
    let live = LiveSignatures::new(SignatureSet::new(
        vec!["pattern1".to_string(), "pattern2".to_string()],
        vec!["tool_cve_pattern".to_string()],
        vec!["CVE-2024-001".to_string(), "CVE-2024-002".to_string()],
    ));

    let stats = live.stats();
    assert_eq!(stats.pattern_count, 3); // 2 injection + 1 tool
    assert_eq!(stats.cve_count, 2);
}

#[tokio::test]
async fn test_concurrent_reads_during_swap() {
    use std::sync::Arc;
    use tokio::task;

    let live = Arc::new(LiveSignatures::new(SignatureSet::default()));
    let live_clone = live.clone();

    // Start concurrent readers
    let reader_task = task::spawn(async move {
        for _ in 0..1000 {
            let _ = live_clone.get().matches_threat("test");
        }
    });

    // Do swaps while readers are running
    for i in 0..10 {
        let new_set = SignatureSet::new(
            vec![format!("pattern_{}", i)],
            vec![],
            vec![],
        );
        live.swap(new_set);
        tokio::task::yield_now().await;
    }

    reader_task.await.unwrap();
    // No panics = success (proves zero-restart atomic swap works)
}
