"""Set PIPELINE_VAULT_KEY in /opt/ndt-portal/.env to a fresh 32-byte hex key."""
import subprocess, re, os

key = subprocess.check_output(["openssl", "rand", "-hex", "32"]).decode().strip()
assert len(key) == 64, f"unexpected key length {len(key)}"

env_path = "/opt/ndt-portal/.env"
with open(env_path) as f:
    content = f.read()

if "PIPELINE_VAULT_KEY=" in content:
    content = re.sub(r"^PIPELINE_VAULT_KEY=.*$", f"PIPELINE_VAULT_KEY={key}", content, flags=re.MULTILINE)
else:
    content += f"\nPIPELINE_VAULT_KEY={key}\n"

tmp = env_path + ".tmp"
with open(tmp, "w") as f:
    f.write(content)
os.rename(tmp, env_path)
print(f"PIPELINE_VAULT_KEY set ({len(key)} hex chars). Restart sanitize + gateway containers.")
