"""Fix n8n owner user and verify API access."""
import subprocess, json, hashlib, os, urllib.request, urllib.error

def psql(sql, db="n8n_db"):
    r = subprocess.run(
        ["docker", "exec", "-i", "cmmc-postgres", "psql",
         "-U", "cmmc_app", "-d", db, "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip(), r.stderr.strip()

def psql_at(sql, db="n8n_db"):
    r = subprocess.run(
        ["docker", "exec", "-i", "cmmc-postgres", "psql",
         "-U", "cmmc_app", "-d", db, "-At", "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip(), r.stderr.strip()

# Check current user state
out, _ = psql('SELECT id, email, "firstName", "lastName", "personalizationAnswers" IS NOT NULL as setup_done FROM "user"')
print("Current user state:")
print(out)

# Update user to have complete owner profile
out, err = psql(
    "UPDATE \"user\" SET "
    "email='admin@cmmc4msp.on-nex.us', "
    "\"firstName\"='MSP', "
    "\"lastName\"='Admin', "
    "\"personalizationAnswers\"='{\"version\": 1}' "
    "WHERE id='0f300145-c953-45ee-8a7d-2de97cf205c7'"
)
print(f"\nUser update: {out} {err}")

# Set the global:owner role for the user if role table exists
out, err = psql("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='role' AND table_schema='public')")
print(f"Role table: {out}")

# Check settings for instanceOwner
out, _ = psql("SELECT key, value FROM settings WHERE key LIKE '%owner%' OR key LIKE '%setup%' LIMIT 5")
print(f"\nSettings: {out}")

# Mark instance as set up
out, err = psql("UPDATE settings SET value='true' WHERE key='userManagement.isInstanceOwnerSetUp'")
print(f"Set instance owner setup: {out} {err}")

# If not found, insert it
if "0 rows" in out or not out:
    out, err = psql("INSERT INTO settings (key, value, \"loadOnStartup\") VALUES ('userManagement.isInstanceOwnerSetUp', 'true', true) ON CONFLICT (key) DO UPDATE SET value='true'")
    print(f"Insert setting: {out} {err}")

# Verify API key exists
out, _ = psql('SELECT "apiKey", "userId" FROM user_api_keys')
print(f"\nAPI Keys: {out}")

print("\nDone. Restart n8n to pick up user changes.")
