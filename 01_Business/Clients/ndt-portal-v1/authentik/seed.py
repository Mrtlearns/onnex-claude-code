#!/usr/bin/env python3
"""
Authentik Seed — idempotent Authentik configuration for NDT Portal.

Run by CI after every docker compose up to ensure Authentik stays
configured correctly even after a DB wipe + fresh setup.

Usage (from CI):
    CNAME=$(docker compose ps -q authentik)
    docker cp authentik/seed.py "$CNAME:/tmp/seed.py"
    docker compose exec -T authentik python /tmp/seed.py

All operations are idempotent — safe to run multiple times.
"""

import os
import sys

# Ensure the container root (where /authentik package lives) is on the path.
# When Python runs a script from /tmp/, it replaces sys.path[0] with '/tmp/'
# which drops the container's WORKDIR ('/') — 'authentik' then can't be found.
if '/' not in sys.path:
    sys.path.insert(0, '/')

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authentik.root.settings")
django.setup()

from authentik.core.models import User
from authentik.flows.models import Flow
from authentik.providers.oauth2.models import OAuth2Provider

# Authentik 2024.x stores validity fields as plain text strings in the format
# "unit=value" (e.g. "hours=8", "days=7"), NOT as Python timedelta objects.
# Assigning a timedelta and saving via Django ORM stores str(timedelta) which
# produces "8:00:00" — a format that timedelta_from_string cannot parse,
# causing a ValueError on the token endpoint (HTTP 405 / system_exception).
# Always use string format: "minutes=N", "hours=N", "days=N".
ACCESS_TOKEN_VALIDITY  = "hours=8"   # 8h access token
REFRESH_TOKEN_VALIDITY = "days=7"    # 7d refresh token

# ── Track changes ─────────────────────────────────────────────────────────────

changes = []
errors = []


def ok(msg: str) -> None:
    print(f"  [OK]     {msg}")


def skip(msg: str) -> None:
    print(f"  [SKIP]   {msg}")


def changed(msg: str) -> None:
    changes.append(msg)
    print(f"  [CHANGE] {msg}")


def error(msg: str) -> None:
    errors.append(msg)
    print(f"  [ERROR]  {msg}", file=sys.stderr)


# ── 1. NDT Portal Provider: use implicit consent flow ─────────────────────────
#
# The default-provider-authorization-explicit-consent flow shows a
# "Grant access to NDT Portal?" screen on every login.
# For a first-party app this is unnecessary — switch to implicit consent.

print("\n── Authentik Seed: NDT Portal configuration ──────────────────────────")

try:
    provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
    if not provider:
        error("NDT Portal Provider not found — run setup_authentik.js first to create the provider")
    else:
        implicit_flow = Flow.objects.filter(
            slug="default-provider-authorization-implicit-consent"
        ).first()
        if not implicit_flow:
            error("default-provider-authorization-implicit-consent flow not found — is Authentik fully initialised?")
        elif provider.authorization_flow_id == implicit_flow.pk:
            skip("Provider already uses implicit consent flow")
        else:
            provider.authorization_flow = implicit_flow
            provider.save(update_fields=["authorization_flow"])
            changed(f"Provider '{provider.name}' → implicit consent flow")
except Exception as exc:
    error(f"Provider update failed: {exc}")


# ── 2. Verify redirect URI includes /login/callback ───────────────────────────
#
# oidc-client-ts sends redirect_uri=http://10.10.110.32:8888/login/callback.
# If Authentik's allowed_redirect_uris doesn't include this, auth will fail.
# The redirect_uris field is a list stored as a JSONField.

try:
    provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
    if provider:
        # In Authentik 2024.x, redirect_uris is stored as a list of
        # RedirectURI objects or plain strings depending on the version.
        # We check the string representation and patch if needed.
        # redirect_uris is stored as a JSONB list of {url, matching_mode} objects.
        # Access via the _redirect_uris DB column using raw SQL to avoid
        # Django ORM field-name conflicts in Authentik 2024.x.
        from django.db import connection
        import json as _json
        with connection.cursor() as _cur:
            _cur.execute(
                "SELECT _redirect_uris FROM authentik_providers_oauth2_oauth2provider WHERE provider_ptr_id = %s",
                [provider.pk]
            )
            current_data = _cur.fetchone()[0]
            if isinstance(current_data, str):
                current_data = _json.loads(current_data)
            existing_urls = {r["url"] for r in current_data}
            required_uris = [
                "https://ndt-v1.on-nex.us/login/callback",  # production
                "http://10.10.110.32:8888/login/callback",   # internal/dev
            ]
            added = []
            for uri in required_uris:
                if uri not in existing_urls:
                    current_data.append({"url": uri, "matching_mode": "strict"})
                    added.append(uri)
            if added:
                _cur.execute(
                    "UPDATE authentik_providers_oauth2_oauth2provider SET _redirect_uris = %s::jsonb WHERE provider_ptr_id = %s",
                    [_json.dumps(current_data), provider.pk]
                )
                changed(f"Added redirect URIs: {', '.join(added)}")
            else:
                skip("All redirect URIs already present")
except Exception as exc:
    error(f"Redirect URI check failed: {exc}")


# ── 3. Token lifetimes ────────────────────────────────────────────────────────
#
# Default Authentik access_token_validity is 5 minutes — too short for a
# portal session. This causes silent renew to fire every ~4 min, which
# disrupts navigation and can cause auth loops.
# Set to 8h access / 7d refresh so renewal is effectively invisible to users.

try:
    provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
    if provider:
        needs_save = False
        if provider.access_token_validity != ACCESS_TOKEN_VALIDITY:
            provider.access_token_validity = ACCESS_TOKEN_VALIDITY
            needs_save = True
        if provider.refresh_token_validity != REFRESH_TOKEN_VALIDITY:
            provider.refresh_token_validity = REFRESH_TOKEN_VALIDITY
            needs_save = True
        if needs_save:
            provider.save(update_fields=["access_token_validity", "refresh_token_validity"])
            changed(f"Token lifetimes → access={ACCESS_TOKEN_VALIDITY}, refresh={REFRESH_TOKEN_VALIDITY}")
        else:
            skip("Token lifetimes already correct")
except Exception as exc:
    error(f"Token lifetime update failed: {exc}")


# ── 4. Super admin users ──────────────────────────────────────────────────────
#
# Create superusers for project administration.
# In Authentik, superuser = internal user + member of "authentik Admins" group.
# Idempotent — skips if user already exists with correct group membership.

SUPER_ADMINS = [
    {"username": "hugh", "email": "hugh@on-nex.com",    "name": "Hugh", "password": "Poll0000"},
    {"username": "mrt",  "email": "mrt@on-nex.com",     "name": "MrT",  "password": "Poll0000"},
]

try:
    from authentik.core.models import Group
    admin_group = Group.objects.filter(is_superuser=True).first()
    if not admin_group:
        error("No superuser group found in Authentik")
    else:
        for spec in SUPER_ADMINS:
            user, created = User.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "name": spec["name"],
                    "is_active": True,
                    "type": "internal",
                    "path": "users",
                },
            )
            if created:
                user.set_password(spec["password"])
                user.save()
                changed(f"Created user '{spec['username']}' ({spec['email']})")
            else:
                skip(f"User '{spec['username']}' already exists")

            if not user.groups.filter(pk=admin_group.pk).exists():
                user.groups.add(admin_group)
                changed(f"Added '{spec['username']}' to '{admin_group.name}' group (superuser)")
            else:
                skip(f"'{spec['username']}' already in '{admin_group.name}' group")
except Exception as exc:
    error(f"Superuser creation failed: {exc}")


# ── 5. JWT signing key: stable custom RS256 certificate ──────────────────────
#
# "authentik Internal JWT Certificate" is auto-managed by Authentik — it gets
# regenerated when it expires (or on every startup in some versions). Each
# regeneration produces a new kid, immediately invalidating all existing tokens
# and forcing every user to re-login.
#
# Fix: create "NDT Portal JWT Certificate" ourselves using cryptography + Django
# ORM. Mark managed=None so Authentik never auto-rotates it. Assign to the
# provider. The certificate is created once and persists as long as the
# Authentik DB volume is intact.

try:
    from authentik.crypto.models import CertificateKeyPair
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import datetime

    NDT_CERT_NAME = "NDT Portal JWT Certificate"

    provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
    if provider:
        # Get or create our stable certificate
        jwt_cert = CertificateKeyPair.objects.filter(name=NDT_CERT_NAME).first()
        if not jwt_cert:
            # Generate RSA-2048 key + self-signed cert (10-year validity)
            key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, "NDT Portal JWT Signing"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "NDT Portal"),
            ])
            now = datetime.datetime.now(datetime.timezone.utc)
            cert = (
                x509.CertificateBuilder()
                .subject_name(subject)
                .issuer_name(issuer)
                .public_key(key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(now)
                .not_valid_after(now + datetime.timedelta(days=3650))  # 10 years
                .sign(key, hashes.SHA256())
            )
            cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
            key_pem  = key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ).decode()
            jwt_cert = CertificateKeyPair.objects.create(
                name=NDT_CERT_NAME,
                certificate_data=cert_pem,
                key_data=key_pem,
                managed=None,  # unmanaged — Authentik will NOT auto-rotate this
            )
            changed(f"Created stable JWT signing certificate '{NDT_CERT_NAME}' (10-year, unmanaged)")

        # Assign to provider if not already set
        if provider.signing_key and provider.signing_key.pk == jwt_cert.pk:
            skip(f"Provider already uses '{NDT_CERT_NAME}' for JWT signing")
        else:
            provider.signing_key = jwt_cert
            provider.save(update_fields=["signing_key"])
            changed(f"Provider signing key → '{NDT_CERT_NAME}' (stable RS256, no auto-rotation)")
except Exception as exc:
    error(f"JWT signing key setup failed: {exc}")


# ── 6. JWT sub claim: use UUID not integer PK ─────────────────────────────────
#
# Default sub_mode is "user_id" which puts the integer PK ("1", "10", etc.)
# in the JWT sub claim. The portal RBAC uses Authentik UUIDs as user identifiers
# (stored in auth.user_roles.user_id). If sub_mode is user_id, role lookups
# always return empty — the integer PK never matches a UUID in the DB.
# Set to user_uuid so the JWT sub is a stable UUID (e.g. "96405777-...").

try:
    from authentik.providers.oauth2.models import SubModes
    provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
    if provider:
        if provider.sub_mode != SubModes.USER_UUID:
            provider.sub_mode = SubModes.USER_UUID
            provider.save(update_fields=["sub_mode"])
            changed("Provider sub_mode → user_uuid (JWT sub is now UUID, not integer PK)")
        else:
            skip("Provider sub_mode already user_uuid")
except Exception as exc:
    error(f"sub_mode update failed: {exc}")


# ── Summary ───────────────────────────────────────────────────────────────────

print()
if changes:
    print(f"Changes applied ({len(changes)}):")
    for c in changes:
        print(f"  • {c}")
else:
    print("No changes needed — Authentik already correctly configured.")

if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors:
        print(f"  ! {e}")
    # Exit non-zero so CI can surface the error, but don't block the deploy
    # (Authentik might not be set up yet on first deploy)
    sys.exit(1)

print()
