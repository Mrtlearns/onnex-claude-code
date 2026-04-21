use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use dashmap::DashMap;
use rcgen::{Certificate, CertificateParams, DistinguishedName, DnType, IsCa, KeyPair, SanType};

/// A generated leaf certificate cached until it expires.
struct CachedCert {
    cert_der: Vec<u8>,
    key_der: Vec<u8>,
    expires_at: Instant,
}

/// Generates per-hostname leaf certificates signed by the Onnex CA.
/// Caches generated certs for `CERT_TTL` to avoid regenerating on every connection.
pub struct CertGen {
    ca_cert: Certificate,
    ca_key: KeyPair,
    cache: Arc<DashMap<String, CachedCert>>,
}

/// Leaf cert validity window — 24 hours.
const CERT_TTL: Duration = Duration::from_secs(24 * 60 * 60);

impl CertGen {
    /// Load the CA cert and key from PEM strings.
    pub fn new(ca_cert_pem: &str, ca_key_pem: &str) -> Result<Self> {
        let ca_key = KeyPair::from_pem(ca_key_pem)
            .context("failed to parse CA private key PEM")?;

        let ca_params = CertificateParams::from_ca_cert_pem(ca_cert_pem)
            .context("failed to parse CA certificate PEM")?;

        // Reconstruct the CA Certificate with its key so we can sign leaf certs with it.
        let ca_cert = ca_params
            .self_signed(&ca_key)
            .context("failed to reconstruct CA certificate for signing")?;

        Ok(CertGen {
            ca_cert,
            ca_key,
            cache: Arc::new(DashMap::new()),
        })
    }

    /// Return a (cert_der, key_der) pair for `hostname`.
    /// Generates a new leaf cert if none is cached or the cached cert has expired.
    pub fn leaf_cert(&self, hostname: &str) -> Result<(Vec<u8>, Vec<u8>)> {
        // Check cache first.
        if let Some(entry) = self.cache.get(hostname) {
            if entry.expires_at > Instant::now() {
                return Ok((entry.cert_der.clone(), entry.key_der.clone()));
            }
        }

        // Generate a fresh leaf cert.
        let (cert_der, key_der) = self.generate_leaf(hostname)?;

        self.cache.insert(
            hostname.to_string(),
            CachedCert {
                cert_der: cert_der.clone(),
                key_der: key_der.clone(),
                expires_at: Instant::now() + CERT_TTL,
            },
        );

        Ok((cert_der, key_der))
    }

    fn generate_leaf(&self, hostname: &str) -> Result<(Vec<u8>, Vec<u8>)> {
        let leaf_key = KeyPair::generate()
            .context("failed to generate leaf key pair")?;

        let mut params = CertificateParams::default();

        // Subject: CN=<hostname>
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, hostname);
        params.distinguished_name = dn;

        // SAN: DNS name matching the intercepted hostname.
        // rcgen 0.13: SanType::DnsName wraps a String.
        params.subject_alt_names = vec![
            SanType::DnsName(hostname.to_string()),
        ];

        // Not a CA.
        params.is_ca = IsCa::NoCa;

        // Validity: now through tomorrow.
        // rcgen 0.13 uses time::OffsetDateTime for not_before / not_after.
        let now = time::OffsetDateTime::now_utc();
        let tomorrow = now + time::Duration::hours(24);
        params.not_before = now;
        params.not_after = tomorrow;

        // Sign the leaf cert with the CA.
        let leaf_cert = params
            .signed_by(&leaf_key, &self.ca_cert, &self.ca_key)
            .context("failed to sign leaf certificate with CA")?;

        let cert_der = leaf_cert.der().to_vec();
        let key_der = leaf_key.serialize_der();

        Ok((cert_der, key_der))
    }
}
