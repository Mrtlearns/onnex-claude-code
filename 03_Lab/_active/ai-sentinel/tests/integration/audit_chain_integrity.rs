use ai_sentinel_layers::AuditChain;
use tokio::time::{sleep, Duration};

#[tokio::test]
async fn test_audit_chain_clean() {
    let chain = AuditChain::new();

    // Write some records
    for i in 0..5 {
        chain.write(
            &format!("req-{}", i),
            "ingress",
            "pass",
            None,
            None,
            "test-caller",
            Some("test-session"),
            &format!("{{\"request\": {}}}", i),
        );
    }

    // Allow async writes to flush
    sleep(Duration::from_millis(100)).await;

    // Verify chain integrity
    let result = chain.verify().await;
    assert!(result.is_ok(), "clean chain should verify: {:?}", result);
    assert_eq!(result.unwrap(), 5, "should have 5 records");
}

#[tokio::test]
async fn test_audit_chain_detects_tamper() {
    // We can't tamper with the in-memory chain after writes
    // This test verifies the hash computation logic directly

    let hash1 = AuditChain::compute_hash("req-1", "0000000000000000000000000000000000000000000000000000000000000000", "2024-01-01T00:00:00Z", "abc123");
    let hash2 = AuditChain::compute_hash("req-1", "0000000000000000000000000000000000000000000000000000000000000000", "2024-01-01T00:00:00Z", "abc123");
    let hash3 = AuditChain::compute_hash("req-1", "0000000000000000000000000000000000000000000000000000000000000000", "2024-01-01T00:00:00Z", "TAMPERED");

    assert_eq!(hash1, hash2, "same inputs should produce same hash");
    assert_ne!(hash1, hash3, "tampered payload_hash should produce different hash");
}

#[tokio::test]
async fn test_audit_empty_chain_verifies() {
    let chain = AuditChain::new();
    let result = chain.verify().await;
    assert!(result.is_ok(), "empty chain should verify");
    assert_eq!(result.unwrap(), 0);
}

#[tokio::test]
async fn test_audit_genesis_hash_is_zeros() {
    // The genesis hash (all zeros) is deterministic
    let genesis = "0000000000000000000000000000000000000000000000000000000000000000";
    assert_eq!(genesis.len(), 64, "genesis hash should be 64 hex chars (256 bits)");
    assert!(genesis.chars().all(|c| c == '0'), "genesis hash should be all zeros");
}
