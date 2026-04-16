#!/usr/bin/env python3
"""
Fix Authentik: set sub_mode to user_uuid so JWT sub is UUID not integer PK.
Also verifies signing key and token lifetimes.
"""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authentik.root.settings")
django.setup()

from authentik.providers.oauth2.models import OAuth2Provider, SubModes

provider = OAuth2Provider.objects.filter(name="NDT Portal Provider").first()
if not provider:
    print("ERROR: NDT Portal Provider not found")
    sys.exit(1)

print(f"Current sub_mode: {provider.sub_mode}")
print(f"Current signing_key: {provider.signing_key}")
print(f"Current access_token_validity: {provider.access_token_validity}")

# Fix sub_mode to use UUID
needs_save = False
if provider.sub_mode != SubModes.USER_UUID:
    provider.sub_mode = SubModes.USER_UUID
    needs_save = True
    print("CHANGE: sub_mode → user_uuid")
else:
    print("OK: sub_mode already user_uuid")

if needs_save:
    provider.save(update_fields=["sub_mode"])
    print("Saved.")

# Verify signing key
if provider.signing_key:
    print(f"OK: signing_key = {provider.signing_key.name}")
else:
    print("WARNING: No signing_key set!")

print(f"\nFinal sub_mode: {provider.sub_mode}")
