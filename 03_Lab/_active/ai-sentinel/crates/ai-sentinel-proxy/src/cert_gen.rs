use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use dashmap::DashMap;
use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DistinguishedName, DnType,
    Ia5String, IsCa, KeyPair, SanType,
};
use tokio::sync::OnceCell;

/// A generated leaf certificate cached until it expires.
struct CachedCert {
    cert_der: Vec<u8>,
    key_der: Vec<u8>,
    expires_at: Instant,
}

/// Generates per-hostname leaf certificates signed by the Onnex CA.
/// Caches generated certs for `CERT_TTL` to avoid regenerating on every connection.
///
/// TOCTOU-safe: uses `OnceCell` per-hostname so that concurrent requests for the
/// same hostname only generate one key pair.
pub struct CertGen {
    ca_cert: Certificate,
    ca_key: KeyPair,
    cache: Arc<DashMap<String, Arc<OnceCell<CachedCert>>>>,
}

/// Leaf cert validity window — 24 hours.
const CERT_TTL: Duration = Duration::from_secs(24 * 60 * 60);

impl CertGen {
    /// Initialise CertGen from the CA's private key PEM.
    ///
    /// rcgen 0.13 cannot parse an existing CA cert from PEM (`from_ca_cert_der` was
    /// added in 0.14). For Phase 4, the CA cert is generated from the provided key
    /// with a fixed DN. The generated cert must be distributed to managed devices
    /// via Ansible (`onnex-ca-deploy.yml`). Phase 5 will upgrade to rcgen 0.14 and
    /// load the real Onnex CA cert from PEM.
    ///
    /// # Arguments
    /// - `_ca_cert_pem`: retained for interface compatibility (Phase 5 will use it)
    /// - `ca_key_pem`: the Onnex intermediate CA private key in PEM format
    pub fn new(_ca_cert_pem: &str, ca_key_pem: &str) -> Result<Self> {
        let ca_key = KeyPair::from_pem(ca_key_pem)
            .context("failed to parse CA private key PEM")?;

        // Build a CA cert from the key with the Onnex intermediate CA DN.
        // TODO Phase 5: load from the real PEM file using rcgen 0.14 from_ca_cert_der.
        let mut ca_params = CertificateParams::default();
        ca_params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "Onnex AI Sentinel Intermediate CA");
        dn.push(DnType::OrganizationName, "Onnex");
        dn.push(DnType::CountryName, "ZA");
        ca_params.distinguished_name = dn;

        let now = time::OffsetDateTime::now_utc();
        ca_params.not_before = now;
        ca_params.not_after = now + time::Duration::days(365);

        let ca_cert = ca_params
            .self_signed(&ca_key)
            .context("failed to generate CA certificate from key")?;

        Ok(CertGen {
            ca_cert,
            ca_key,
            cache: Arc::new(DashMap::new()),
        })
    }

    /// Return a (cert_der, key_der) pair for `hostname`.
    /// Returns cached cert if still valid; generates a new one otherwise.
    ///
    /// Thread-safe: concurrent calls for the same hostname collapse into a single
    /// key-pair generation via `OnceCell`.
    pub async fn leaf_cert(&self, hostname: &str) -> Result<(Vec<u8>, Vec<u8>)> {
        let cell = self
            .cache
            .entry(hostname.to_string())
            .or_insert_with(|| Arc::new(OnceCell::new()))
            .clone();

        let cached = cell
            .get_or_try_init(|| async {
                let (cert_der, key_der) = self.generate_leaf(hostname)?;
                Ok::<CachedCert, anyhow::Error>(CachedCert {
                    cert_der,
                    key_der,
                    expires_at: Instant::now() + CERT_TTL,
                })
            })
            .await?;

        // If expired, evict and recurse once.
        if cached.expires_at <= Instant::now() {
            self.cache.remove(hostname);
            return Box::pin(self.leaf_cert(hostname)).await;
        }

        Ok((cached.cert_der.clone(), cached.key_der.clone()))
    }

    /// Drop all expired cache entries.
    /// Intended to be called periodically from a background task.
    pub fn evict_expired(&self) {
        let now = Instant::now();
        self.cache.retain(|_, cell| {
            cell.get().map(|c| c.expires_at > now).unwrap_or(true)
        });
    }

    fn generate_leaf(&self, hostname: &str) -> Result<(Vec<u8>, Vec<u8>)> {
        let leaf_key = KeyPair::generate()
            .context("failed to generate leaf key pair")?;

        let mut params = CertificateParams::default();

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, hostname);
        params.distinguished_name = dn;

        params.subject_alt_names = vec![
            SanType::DnsName(
                Ia5String::try_from(hostname.to_string())
                    .map_err(|e| anyhow::anyhow!("invalid DNS name '{hostname}': {e:?}"))?,
            ),
        ];

        params.is_ca = IsCa::NoCa;

        let now = time::OffsetDateTime::now_utc();
        params.not_before = now;
        params.not_after = now + time::Duration::hours(24);

        let leaf_cert = params
            .signed_by(&leaf_key, &self.ca_cert, &self.ca_key)
            .context("failed to sign leaf certificate with CA")?;

        let cert_der = leaf_cert.der().to_vec();
        let key_der = leaf_key.serialize_der();

        Ok((cert_der, key_der))
    }
}
