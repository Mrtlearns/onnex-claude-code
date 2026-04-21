use std::net::IpAddr;

/// Signal 4: known LLM provider IP ranges (Phase 4 static list; Phase 5 adds ASN lookup).
/// Conservative: only IPs we're certain about. False negatives are fine — other signals cover.
static KNOWN_LLM_CIDRS: &[&str] = &[
    // Anthropic (AS394161)
    "160.79.104.0/23",
    // OpenAI (AS20473)
    "23.98.80.0/20",
    // Google AI APIs (AS15169 — specific subnets for generativelanguage.googleapis.com).
    // 34.0.0.0/8 was previously used but covers the entire Google ASN (far too broad).
    "34.96.0.0/20",
    "34.104.0.0/22",
    "35.184.0.0/13",
];

pub fn matches(src_ip: &IpAddr) -> bool {
    use std::net::IpAddr::*;
    match src_ip {
        V4(ip) => {
            let ip_u32 = u32::from(*ip);
            for cidr in KNOWN_LLM_CIDRS {
                if let Ok(parsed) = cidr.parse::<ipnet::Ipv4Net>() {
                    if parsed.contains(ip) {
                        return true;
                    }
                    let _ = ip_u32; // suppress warning
                }
            }
            false
        }
        V6(_) => false, // Phase 5: add IPv6 ranges
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    #[test]
    fn anthropic_ip_matches() {
        // 160.79.104.1 is in 160.79.104.0/23
        let ip: IpAddr = "160.79.104.1".parse().unwrap();
        assert!(matches(&ip));
    }

    #[test]
    fn private_ip_does_not_match() {
        let ip: IpAddr = "192.168.1.1".parse().unwrap();
        assert!(!matches(&ip));
    }

    #[test]
    fn random_public_ip_does_not_match() {
        let ip: IpAddr = "1.1.1.1".parse().unwrap();
        assert!(!matches(&ip));
    }
}
