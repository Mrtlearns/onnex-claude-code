use std::net::IpAddr;
use std::time::{SystemTime, UNIX_EPOCH};

/// Derives a stable session ID from the network 5-tuple using blake3.
/// Format: hex(blake3(src_ip || dst_ip || src_port || dst_port || conn_start_ts_secs))
///
/// conn_start_ts_secs truncated to 1-second granularity so that all packets
/// from the same connection map to the same session ID.
pub fn network_session_id(
    src_ip: &IpAddr,
    dst_ip: &IpAddr,
    src_port: u16,
    dst_port: u16,
    conn_start_ts_secs: u64,
) -> String {
    let mut hasher = blake3::Hasher::new();
    match src_ip {
        IpAddr::V4(ip) => { hasher.update(&ip.octets()); }
        IpAddr::V6(ip) => { hasher.update(&ip.octets()); }
    }
    match dst_ip {
        IpAddr::V4(ip) => { hasher.update(&ip.octets()); }
        IpAddr::V6(ip) => { hasher.update(&ip.octets()); }
    }
    hasher.update(&src_port.to_be_bytes());
    hasher.update(&dst_port.to_be_bytes());
    hasher.update(&conn_start_ts_secs.to_be_bytes());
    hex::encode(hasher.finalize().as_bytes())
}

/// Convenience: derive session ID using current unix timestamp (1s granularity).
pub fn network_session_id_now(
    src_ip: &IpAddr,
    dst_ip: &IpAddr,
    src_port: u16,
    dst_port: u16,
) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    network_session_id(src_ip, dst_ip, src_port, dst_port, ts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    #[test]
    fn same_tuple_produces_same_id() {
        let src: IpAddr = "10.0.0.1".parse().unwrap();
        let dst: IpAddr = "160.79.104.1".parse().unwrap();
        let id1 = network_session_id(&src, &dst, 54321, 443, 1_700_000_000);
        let id2 = network_session_id(&src, &dst, 54321, 443, 1_700_000_000);
        assert_eq!(id1, id2);
    }

    #[test]
    fn different_src_port_produces_different_id() {
        let src: IpAddr = "10.0.0.1".parse().unwrap();
        let dst: IpAddr = "160.79.104.1".parse().unwrap();
        let id1 = network_session_id(&src, &dst, 54321, 443, 1_700_000_000);
        let id2 = network_session_id(&src, &dst, 54322, 443, 1_700_000_000);
        assert_ne!(id1, id2);
    }

    #[test]
    fn id_is_64_hex_chars() {
        let src: IpAddr = "10.0.0.1".parse().unwrap();
        let dst: IpAddr = "160.79.104.1".parse().unwrap();
        let id = network_session_id(&src, &dst, 54321, 443, 1_700_000_000);
        assert_eq!(id.len(), 64);
    }
}
