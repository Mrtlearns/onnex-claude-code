use std::sync::Arc;

use anyhow::{Context, Result};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

/// Upstream TLS connection to the real LLM provider.
///
/// # Phase 5 TODO
/// Replace `NoVerifier` with per-provider certificate pinning.
/// Until then we accept any upstream cert — this is acceptable because:
/// 1. The proxy runs on trusted Onnex infrastructure (not a user device).
/// 2. TLS still provides transport encryption; we just skip chain validation.
pub async fn connect_upstream(
    hostname: &str,
    port: u16,
) -> Result<tokio_rustls::client::TlsStream<TcpStream>> {
    let tcp = TcpStream::connect(format!("{hostname}:{port}"))
        .await
        .with_context(|| format!("TCP connect to {hostname}:{port} failed"))?;

    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerifier))
        .with_no_client_auth();

    let connector = TlsConnector::from(Arc::new(config));
    let server_name = ServerName::try_from(hostname.to_string())
        .context("hostname is not a valid ServerName")?;

    let stream = connector
        .connect(server_name, tcp)
        .await
        .with_context(|| format!("TLS handshake with {hostname} failed"))?;

    Ok(stream)
}

/// Bidirectional byte-copy between a client-side and upstream-side stream.
/// Returns when either side closes the connection.
pub async fn tunnel(
    mut client: impl AsyncRead + AsyncWrite + Unpin,
    mut upstream: impl AsyncRead + AsyncWrite + Unpin,
) -> Result<()> {
    tokio::io::copy_bidirectional(&mut client, &mut upstream)
        .await
        .context("bidirectional tunnel error")?;
    Ok(())
}

// ─── No-op certificate verifier ───────────────────────────────────────────────

/// Accepts any server certificate without verification.
///
/// # Security note
/// This is intentional for Phase 4. The proxy is deployed on private Onnex infrastructure;
/// upstream cert validation will be added in Phase 5 with per-provider certificate pinning.
#[derive(Debug)]
struct NoVerifier;

impl ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> std::result::Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> std::result::Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> std::result::Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::ED25519,
        ]
    }
}
