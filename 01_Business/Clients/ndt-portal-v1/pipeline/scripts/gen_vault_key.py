#!/usr/bin/env python3
"""Generate a random 32-byte vault key and print as hex.

Usage:
    python gen_vault_key.py

Copy the output into GitLab CI variable PIPELINE_VAULT_KEY (protected, masked).
Never commit this value.
"""
import os

key = os.urandom(32)
print(key.hex())
