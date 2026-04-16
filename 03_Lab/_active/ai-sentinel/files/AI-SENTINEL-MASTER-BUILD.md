# AI-Sentinel — Master Build Document
## Onnex · Confidential · v1.0 · March 2026
### Complete handoff: VM provisioning + Claude Code GSD build sheet + deploy scripts

---

> This is the single source of truth for the AI-Sentinel project.
> It contains four sections:
> - **Part A** — VM Provisioning Runbook (for claude-controller)
> - **Part B** — Claude Code GSD Build Sheet (CLAUDE.md — copy to project root)
> - **Part C** — Deploy Scripts (copy to `scripts/` directory)
> - **Part D** — Project Context (copy to `context/` directory)

---

# PART A — VM Provisioning Runbook

## VM Specification

| Parameter | Value |
|---|---|
| VM name | `ai-sentinel-build` |
| OS | Ubuntu 24.04 LTS (minimal server) |
| vCPU | 4 |
| RAM | 8 GB |
| Disk | 32 GB (thin provisioned is fine) |
| Network | same bridge as other VMs (e.g. vmbr0) |
| IP | static, assign next available in your range |
| Purpose | Rust build target for AI-Sentinel project. No GUI. No Claude Code. No dev frameworks. Build tools only. |

**Why 32GB not 100GB:**
Rust toolchain ~1.5GB + compile cache ~4GB + Docker images ~2GB + OS ~2GB + headroom = ~11GB actual use.
32GB gives comfortable room for multiple projects sharing this VM in future.

---

## Section 1 — Proxmox VM creation

Create the VM on Proxmox. If using the CLI on the Proxmox host:

```bash
# Download Ubuntu 24.04 minimal ISO if not already present
# (skip if ISO already on Proxmox storage)
wget -O /var/lib/vz/template/iso/ubuntu-24.04-live-server-amd64.iso \
  https://releases.ubuntu.com/24.04/ubuntu-24.04.1-live-server-amd64.iso

# Create VM (adjust vmid, storage, bridge to match your environment)
qm create 150 \
  --name ai-sentinel-build \
  --memory 8192 \
  --cores 4 \
  --net0 virtio,bridge=vmbr0 \
  --cdrom local:iso/ubuntu-24.04-live-server-amd64.iso \
  --scsihw virtio-scsi-pci \
  --scsi0 local-lvm:32 \
  --boot order=scsi0;ide2 \
  --agent enabled=1

# Start VM
qm start 150
```

Then complete Ubuntu installation via Proxmox VNC console:
- Language: English
- Keyboard: US
- Network: configure static IP
- Storage: use entire disk, no LVM (simpler for a build VM)
- Username: `build` (or root if you prefer for consistency with other VMs)
- Hostname: `ai-sentinel-build`
- Install OpenSSH server: YES
- Do NOT install any snaps or additional packages during setup

---

## Section 2 — First SSH connection and baseline

Once Ubuntu is up and you can reach it by SSH:

```bash
ssh build@<VM_IP>
```

Run as root (sudo -i or use root user depending on your setup):

```bash
sudo -i

# Verify we are on the right machine
hostname && lsb_release -a && df -h /

# Update base system
apt update && apt upgrade -y

# Install essential build dependencies
apt install -y \
  curl \
  git \
  pkg-config \
  libssl-dev \
  build-essential \
  ca-certificates \
  gnupg \
  lsb-release \
  python3 \
  python3-pip

# Confirm versions
curl --version | head -1
git --version
python3 --version
```

---

## Section 3 — Rust toolchain

```bash
# Install rustup (non-interactive)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Load into current shell
source ~/.cargo/env

# Verify
rustc --version
cargo --version

# Make permanent for all future SSH sessions
echo 'source ~/.cargo/env' >> ~/.bashrc
echo 'source ~/.cargo/env' >> ~/.profile

# Install stable toolchain explicitly
rustup toolchain install stable
rustup default stable

# Verify final state
rustup show
```

Expected output: `stable-x86_64-unknown-linux-gnu (default)` and a rustc version ≥ 1.75

---

## Section 4 — Docker

```bash
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker engine and compose plugin
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Add build user to docker group (no sudo needed for docker commands)
usermod -aG docker build

# Verify Docker
docker --version
docker compose version

# Quick smoke test
docker run --rm hello-world
```

Expected: Docker version 25+ and compose v2. hello-world must print success.

---

## Section 5 — Project directory

```bash
# Create the AI-Sentinel project root
mkdir -p /opt/ai-sentinel/infra/env
mkdir -p /opt/ai-sentinel/config

# Set ownership so build user can write to it
chown -R build:build /opt/ai-sentinel

# Verify
ls -la /opt/ai-sentinel/
```

---

## Section 6 — Pre-pull Docker images

Pull the images AI-Sentinel depends on now so the first build doesn't
wait on downloads:

```bash
# Pull as build user (now in docker group — may need new shell)
su - build -c "docker pull mcr.microsoft.com/presidio-analyzer:latest"
su - build -c "docker pull postgres:16-alpine"
su - build -c "docker pull redis:7-alpine"

# Check total image size
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

Expected total image footprint: ~1.8GB

---

## Section 7 — Cargo pre-cache (optional but saves first-build time)

This creates a dummy project to pre-compile the Rust standard library
and common dependencies so AI-Sentinel's first `cargo build` is faster:

```bash
su - build << 'EOF'
source ~/.cargo/env

# Create a throwaway project to warm the registry cache
mkdir -p /tmp/cargo-warmup && cd /tmp/cargo-warmup
cat > Cargo.toml << 'TOML'
[package]
name = "warmup"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
axum = "0.7"
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio"] }
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
TOML

mkdir src && echo 'fn main(){}' > src/main.rs
cargo build 2>&1 | tail -5

# Clean up project but cache stays in ~/.cargo/registry
cd / && rm -rf /tmp/cargo-warmup
echo "Cargo cache warmed"
EOF
```

This takes 3-5 minutes but means AI-Sentinel's first build compiles
in ~2 minutes instead of 8+.

---

## Section 8 — SSH hardening

```bash
# Ensure SSH key auth works (add Windows dev machine public key)
mkdir -p /home/build/.ssh
chmod 700 /home/build/.ssh

# Paste the public key from the Windows dev machine here:
# cat >> /home/build/.ssh/authorized_keys << 'KEY'
# ssh-rsa AAAA... (paste Windows machine public key)
# KEY

chmod 600 /home/build/.ssh/authorized_keys
chown -R build:build /home/build/.ssh

# Verify key-based auth works before disabling password auth
# (test from Windows first, then optionally harden):
# sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
# systemctl restart sshd
```

---

## Section 9 — Verification checklist

Run all of these. Every line must succeed before reporting completion.

```bash
# Switch to build user for all checks
su - build << 'CHECKS'
source ~/.cargo/env

echo "=== Rust ==="
rustc --version
cargo --version

echo "=== Docker ==="
docker --version
docker compose version
docker run --rm hello-world 2>&1 | grep "Hello from Docker"

echo "=== Project directory ==="
ls -la /opt/ai-sentinel/
touch /opt/ai-sentinel/write-test && rm /opt/ai-sentinel/write-test && echo "Write access OK"

echo "=== Disk space ==="
df -h / | tail -1

echo "=== Memory ==="
free -h | grep Mem

echo "=== Network (can reach external for feed worker) ==="
curl -sf https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1 \
  -o /dev/null && echo "NVD API reachable" || echo "NVD API UNREACHABLE"

echo "=== Pre-pulled images ==="
docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "presidio|postgres|redis"

echo "=== All checks complete ==="
CHECKS
```

---

## Section 10 — Report back

After completing all sections, report:

1. VM IP address assigned
2. SSH user and auth method (password or key)
3. Output of Section 9 verification (paste the full output)
4. Disk usage: `df -h /`
5. Any steps that had warnings or required deviation

---

## What is NOT installed on this VM

This is intentional. Do not install any of the following:

- Claude Code CLI
- npm / Node.js
- Any Onnex framework files (.claude/, agents/, skills/)
- Python packages beyond what apt provides
- Any project source code (source is uploaded by paramiko from Windows)

The VM is a clean build target. All intelligence stays on Windows.
The VM executes `cargo` and `docker` commands and nothing else.

---

## VM snapshot recommendation

After Section 9 passes, take a Proxmox snapshot named `baseline-clean`.
This gives a known-good restore point before the first build run.

```bash
# On Proxmox host
qm snapshot 150 baseline-clean --description "Clean build environment, pre-AI-Sentinel source"
```

---

*AI-Sentinel build VM provisioning runbook*
*For claude-controller use · Onnex infrastructure · March 2026*

---

# PART B — Claude Code GSD Build Sheet
### Save this section as `CLAUDE.md` in your project root

# AI-Sentinel — Complete Build Handoff
## Claude Code GSD Document · Onnex · Confidential · v1.0 · March 2026

---

## Operational mode

This file is the authoritative `CLAUDE.md` for the AI-Sentinel project. Claude Code must treat every instruction in this file as a binding directive, not a suggestion.

**GSD mode is active. The following rules govern this entire session:**

- Read this entire file before touching any file in the project
- Execute the build steps in section 9 in exact order — do not reorder, skip, or parallelize
- Do not ask for confirmation on any decision already specified in this file
- Do not summarise, explain, or announce what you are about to do — start doing it
- Do not say "I'll now implement..." — just implement it
- After every build step: run `cargo check` and fix all errors before moving to the next step
- After step 4: `cargo build --release` must produce a binary that responds to `GET /health`
- After step 15: `cargo test` must pass all integration tests with zero failures
- On ambiguity not covered by this file: make the most conservative and secure choice, leave a `// TODO(claude): <reason>` comment, and continue — do not stop and ask
- If a dependency is missing: add it to the correct `Cargo.toml` and continue
- If a file already exists: check its content, update only what differs from this spec, continue

**This session ends when all 15 build steps are complete and the verification checklist in section 16 passes.**

---

## Bash commands

**All build and test commands execute on the remote VM via paramiko scripts.**
Claude Code runs Python scripts locally on Windows. The scripts SFTP source
files to the VM and SSH in to run cargo/docker commands there.
Do NOT run `cargo` or `docker` directly — they are not installed on Windows.

Claude Code may run any of the following without asking permission:

```bash
# Upload source + cargo check (primary dev loop)
python scripts/deploy_build.py

# Upload source + cargo build --release
python scripts/deploy_build.py --release

# cargo check without re-uploading (quick syntax check)
python scripts/deploy_build.py --check-only

# Upload without building
python scripts/deploy_build.py --upload-only

# Start all containers on VM
python scripts/deploy_containers.py --up

# Start with Docker image rebuild (after --release)
python scripts/deploy_containers.py --up --build

# Check container status
python scripts/deploy_containers.py --status

# Tail container logs
python scripts/deploy_containers.py --logs

# Run all integration tests on VM
python scripts/verify_build.py --all-tests

# Run a specific integration test
python scripts/verify_build.py --test feed_hotswap

# Hit /health endpoint on VM
python scripts/verify_build.py --health

# Run section 16 verification checklist
python scripts/verify_build.py --checklist

# Install paramiko if not present
pip install paramiko
```

Claude Code must NOT run any of the following without explicit human approval:

```bash
python scripts/deploy_containers.py --down   # stops running services
git push                                      # pushes to remote
rm -rf                                        # destructive deletion
```

---

## 1. What Is AI-Sentinel

AI-Sentinel is an **enterprise AI security sidecar** — a self-contained HTTP service that sits beside any AI agent runtime and provides layered security protection on every inbound and outbound call. It is sold to enterprise clients as a drop-in protection module that works across any agent framework without modifying agent code.

**The single integration pattern is:**

```
# Before LLM call
POST http://ai-sentinel:8742/check
{ "direction": "ingress", "payload": {...}, "session_id": "...", "caller_context": {...} }

# After LLM response
POST http://ai-sentinel:8742/check
{ "direction": "egress", "payload": {...}, "session_id": "...", "caller_context": {...} }
```

Every caller — n8n workflows, Temporal activities, raw Anthropic SDK calls, Claude Code pipelines, or any HTTP client — uses this identical interface. AI-Sentinel inspects the payload through a configurable security pipeline and returns either `{"status":"pass"}` or `{"status":"reject", "reject": {"layer":"...", "code":"...", "reason":"..."}}`.

**Why Rust:** Enterprise security product. Memory safety by construction. Single static binary. No runtime dependency CVE surface. The CISO sales conversation ends at "Rust" — it does not end at "Python with mitigations."

**Owner:** Onnex, Las Vegas, Nevada. Built for enterprise AI/agent verticals: NDT/aerospace (ITAR), medical, MSP, PI law.

---

## 2. Architecture — The Full Picture

### 2.1 The Sidecar Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Any Caller                                │
│  n8n webhook │ Temporal activity │ Claude SDK │ HTTP client  │
└──────────────────────┬──────────────────────────────────────┘
                       │  POST /check (HTTP/JSON)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              AI-Sentinel Sidecar  :8742                        │
│  Language-agnostic · Stateless or session-scoped            │
│  Single Rust binary · TLS via Traefik                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  L0  Telemetry envelope  (wraps entire pipeline)     │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  L1  Input sanitization                        │  │  │
│  │  │  L2  Identity & trust (L2.1/L2.2/L2.3/L2.4)   │  │  │
│  │  │  L3  Semantic intent guard  [stub Phase 1]     │  │  │
│  │  │  L4  Tool & action authorization               │  │  │
│  │  │  L5  Execution sandbox                         │  │  │
│  │  │  L6  Output inspection       [stub Phase 1]    │  │  │
│  │  │  L7  Audit hash-chain        [always async]    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Session store (feature-flagged, optional):                 │
│  In-process DashMap │ Redis │ Postgres/pgvector             │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
              Response to caller
              {"status":"pass","payload":{...}}
                      OR
              {"status":"reject","reject":{...}}
```

### 2.2 The Call Flow

```
Caller
  │
  ├─► POST /check direction=ingress
  │     L1: prompt injection? PII? token budget?     ─► REJECT if fail
  │     L2.1: valid bearer token or API key?         ─► REJECT if fail
  │     L2.2: valid trust chain token?               ─► REJECT if fail
  │     L2.3: matches CVE/threat signature?          ─► REJECT if fail
  │     L4: tool in allowed list? destructive?       ─► DENY if fail
  │     L5: within rate limit and cost cap?          ─► REJECT if fail
  │     L7: append audit record (async)
  │     ◄─ {"status":"pass","payload":{...}}
  │
  ├─► Agent / LLM call  (only runs if ingress passed)
  │
  ├─► POST /check direction=egress
  │     L6: exfiltration? SSRF? PII egress?          ─► BLOCK if fail
  │     L7: append audit record (async)
  │     ◄─ {"status":"pass","payload":{...}}
  │
  └─► Caller receives clean response
```

### 2.3 The Session Model

Three layers require cross-call state:

- **L3** — stores declared intent baseline at session start for drift detection
- **L5** — stores action count, cumulative cost, rate window timestamp
- **L7** — stores previous record hash for chain integrity

State is **optional**. Callers that omit `session_id` get pure stateless checks. L3, stateful L5, and L7 chaining are automatically bypassed.

Session backends (configured via `AI_SENTINEL_STORE_BACKEND`):
- `memory` — DashMap, in-process, dev/single-node
- `redis` — deadpool-redis, multi-node, shared rate limiting
- `postgres` — sqlx, enterprise, long-term L3 baseline + full audit

### 2.4 L0 Telemetry — The Envelope

L0 wraps the **entire pipeline** and is not a Layer trait implementor. It runs in the API handler:

```
Request arrives
  │
  └─► L0 entry: stamp request_id, timestamp, caller, session_id, direction,
                model, provider, raw tokens, cost
        │
        └─► Security pipeline (L1 → L7)
              │
              └─► Response sent to caller  ← happens here, latency stops here
                    │
                    └─► L0 exit: spawn async task, write TelemetryRecord
                          fields: decision, reject_layer, reject_code,
                                  latency_ms, layers_ran, per_layer_ms,
                                  completion_tokens, prompt_tokens, cost_usd,
                                  drift_score, rate_counter, payload_in/out
```

Verbosity levels: `off | minimal | standard | full | debug`
- `minimal` — decision + latency only
- `standard` — + model, provider, tokens, cost, caller (default)
- `full` — + sanitized payloads in and out
- `debug` — + raw unsanitized payloads (dev only, never production)

### 2.5 L2.3 Threat Intel Feed — The Hot-Swap

```
External sources                 ai-sentinel process
─────────────────                ──────────────────────────────────────────
CrowdSec CTI API  ──┐            ┌─ Feed worker (background tokio task)
NVD API           ──┤  poll/     │    polls every AI_SENTINEL_FEED_INTERVAL_SECS
OWASP LLM Top 10  ──┤  webhook   │    OR triggered by POST /admin/feed/refresh
Custom JSON file  ──┘            │
                                 │    builds new SignatureSet in scratch buffer
                                 │    ↓
                                 │  Arc<RwLock<SignatureSet>>
                                 │    atomic pointer swap  ← microseconds
                                 │    readers never block
                                 ▼
                          L2.3 check (every ingress/egress):
                            1. IP blocklist match
                            2. Pattern signature match (RegexSet)
                            3. Tool call CVE pattern match
                            4. Provider advisory check
```

**Zero-restart guarantee:** New CVE → CrowdSec picks up → feed worker polls → new SignatureSet built → atomic swap → **active within configured interval. No restart. No interruption.**

---

## 3. Layer Specifications

### L0 — Telemetry Envelope

| | |
|---|---|
| **Type** | Pipeline wrapper, not a Layer trait implementor |
| **Direction** | Both (wraps all) |
| **Hot path impact** | Zero — async write after response returned |
| **Purpose** | Full-fidelity observability of every transaction: tokens, cost, model, provider, latency, decision |
| **Separation from L7** | L0 = operational telemetry (billing, dashboards, debugging). L7 = security audit (compliance, forensics, tamper evidence). Different stores, different consumers, different retention policies. |
| **PII handling** | Strips PII before write when `AI_SENTINEL_TELEMETRY_PII_REDACT=true` (default true) — runs its own fast PII regex independent of L1 because L0 runs before L1 completes |
| **Backends** | stdout \| file \| postgres \| otel \| multi |
| **Phase 1** | Fully implemented |

### L1 — Input Sanitization

| | |
|---|---|
| **Direction** | Ingress only |
| **Purpose** | Syntactic defence — examines the shape and content of the incoming payload before it reaches the agent |
| **Threat** | Prompt injection, unbounded context, PII leakage to LLM provider logs |
| **Rejection codes** | `PROMPT_INJECTION` \| `TOKEN_BUDGET_EXCEEDED` \| `PII_CRITICAL` |
| **Mutation codes** | `PII_STRIPPED` — returns Mutate (cleaned payload), not Reject |
| **Phase 1** | Fully implemented |

**Prompt injection patterns (compiled as RegexSet at startup):**

```
(?i)(ignore|disregard|forget).{0,30}(previous|prior|above|instruction)
(?i)(you are now|act as|pretend to be|your new role)
(?i)(system prompt|hidden instruction|override|jailbreak)
(?i)<\s*(script|iframe|object|embed|link)[^>]*>
(?i)(eval|exec|__import__|subprocess|os\.system)
[;&|`$(){}\[\]]   ← shell injection in tool arg strings
```

**PII detection:**
1. Call `http://presidio-analyzer:5002` (Presidio ML model) with 10ms timeout
2. On timeout/unavailability: fallback to built-in regex patterns (email, SSN, phone, CC, IP)
3. Detected PII → Mutate (strip + replace with typed placeholder) unless severity=critical → Reject

### L2 — Identity and Trust

Four sub-layers run in sequence. First reject exits pipeline.

#### L2.1 — Caller Authentication

| | |
|---|---|
| **Direction** | Ingress only |
| **Purpose** | Every request must prove who it is before any security logic runs |
| **Mechanism** | JWT Bearer token (HMAC-SHA256, secret from `AI_SENTINEL_JWT_SECRET`) OR SHA-256 API key hash against `AI_SENTINEL_API_KEYS` allowlist |
| **Rejection code** | `UNAUTHORIZED` |

#### L2.2 — Trust Chain Verification

| | |
|---|---|
| **Direction** | Ingress only |
| **Purpose** | In multi-agent systems, agent A calls agent B. Without this, anyone who can make an HTTP request can impersonate agent A. |
| **Mechanism** | Validate `caller_context.trust_token` — HMAC-SHA256 over `{caller_id}.{session_id}.{timestamp}` using `AI_SENTINEL_TRUST_SECRET` |
| **Rejection codes** | `TRUST_CHAIN_INVALID` \| `TRUST_TOKEN_EXPIRED` (>60s) \| `TRUST_CALLER_MISMATCH` |
| **If absent** | Pass — single-agent calls do not carry chain tokens |

#### L2.3 — Threat Intelligence Matching

| | |
|---|---|
| **Direction** | Ingress and Egress |
| **Purpose** | Match requests against live CVE feed signatures. Active immediately on new CVE — no restart required. |
| **Mechanism** | Read from `Arc<RwLock<SignatureSet>>` — atomic hot-swap by background feed worker |
| **Checks** | IP blocklist → pattern signatures → tool CVE patterns → provider advisories |
| **Rejection codes** | `IP_BLOCKLIST` \| `CVE_SIGNATURE_MATCH` \| `TOOL_CVE` \| `PROVIDER_ADVISORY` |
| **`block_on_advisory`** | `false` (default) = log-only for provider advisories. `true` = hard reject if advisory matches target model/provider |
| **Feed sources** | CrowdSec CTI API + NVD API + OWASP LLM Top 10 + custom JSON file |

#### L2.4 — MCP Environment Filtering

| | |
|---|---|
| **Direction** | Ingress only (applied at subprocess spawn time) |
| **Purpose** | MCP tool subprocesses inherit the parent process environment by default, which contains API keys, DB URLs, admin tokens. This strips all of that before the subprocess executes. |
| **Mechanism** | Override subprocess spawn with `env_clear()` then selectively re-insert whitelist: `PATH, HOME, USER, LANG, LC_ALL, TERM, SHELL, TMPDIR` |
| **Does not apply to** | MCP servers communicating over network sockets (they don't inherit process env) |
| **Why L2 not L4** | This is a trust boundary crossing (passing secrets from trusted to less-trusted context) — L2 owns trust boundaries. L4 is authorization (what the tool can do), not what it can see. |

### L3 — Semantic Intent Guard

| | |
|---|---|
| **Direction** | Ingress |
| **Purpose** | Detect behavioral drift — the gradual accumulation of context across a long session that expands what an agent considers its legitimate scope (salami-slicing attacks) |
| **Mechanism** | Baseline declared intent at session start. Compute cosine similarity on every subsequent call. Threshold breach → HOLD (human review) or INTENT_DRIFT reject. |
| **Session requirement** | Required (no session_id = layer skipped) |
| **Rejection code** | `INTENT_DRIFT` |
| **Phase 1** | **STUB — pass-through, no-op.** Interface defined, session schema defined. Semantic computation (embedding model) deferred to Phase 2 to avoid external dependency in Phase 1 binary. |

### L4 — Tool and Action Authorization

| | |
|---|---|
| **Direction** | Ingress (when `tool_manifest` present) |
| **Purpose** | Govern which tools an agent may invoke and under what conditions |
| **RBAC** | Role defined in JWT claims or caller context. Role's allowed tools loaded from `AI_SENTINEL_RBAC_PATH` JSON file. Hot-reloaded on SIGHUP. |
| **Destructive gate** | Configurable list of destructive tool names (delete, drop, rm, truncate, format) — denied by default even for authorized roles. Explicit opt-in required in RBAC config. |
| **CVE patterns** | Checks tool invocation against L2.3 SignatureSet tool_cve_patterns |
| **Rejection codes** | `TOOL_NOT_AUTHORIZED` \| `DESTRUCTIVE_TOOL_DENIED` \| `TOOL_CVE` \| `FORBIDDEN_ARGS` |
| **Phase 1** | Fully implemented |

### L5 — Execution Sandbox

| | |
|---|---|
| **Direction** | Ingress |
| **Purpose** | Runtime resource governance — prevent runaway cost, rate abuse, and provide emergency stop capability |
| **Algorithm** | Token bucket (not sliding window — predictable, deterministic burst capacity) |
| **Rate limit** | Actions per hour per session_id (falls back to caller_id if no session) |
| **Cost cap** | Cumulative daily cost_usd from `caller_context.cost_usd` — sourced from caller, enforced by AI-Sentinel |
| **E-stop** | `POST /admin/estop {session_id or caller_id}` → all subsequent L5 checks for that target return `ESTOP` until lifted |
| **Rejection codes** | `RATE_LIMIT` \| `COST_CAP` \| `TOKEN_BUDGET` \| `ESTOP` |
| **Phase 1** | Fully implemented |

### L6 — Output Inspection

| | |
|---|---|
| **Direction** | Egress |
| **Purpose** | Last active security gate before response exits pipeline. Exfiltration prevention, SSRF protection, final PII check. |
| **SSRF protection** | Scan URL-containing outputs for private IP ranges, link-local addresses (169.254.169.254, fd00:ec2::254), localhost references |
| **Rejection codes** | `SSRF_URL` \| `EXFILTRATION_PATTERN` \| `PII_EGRESS` |
| **Phase 1** | **STUB — pass-through, no-op.** Interface defined. Implementation deferred to Phase 2. |

### L7 — Audit Hash Chain

| | |
|---|---|
| **Direction** | Both (always fires, always async) |
| **Purpose** | Immutable tamper-evident record of every security decision. Modifying any record breaks the chain — immediately detectable. |
| **Hash** | SHA-256 over `record_id + prev_hash + timestamp + payload_hash`. Genesis prev_hash = `0000...0000`. |
| **Async** | Always written AFTER response returned to caller. Never on hot path. Zero latency impact. |
| **Failsafe** | In-memory buffer (max 10,000 records) if Postgres unavailable. Flush on reconnect. |
| **Verification** | `GET /admin/audit/verify` — walks chain from genesis, returns first integrity failure |
| **Separation from L0** | L7 = security decisions + tamper evidence (compliance, forensics). L0 = operational reality (billing, debugging). |
| **Phase 1** | Fully implemented |

---

## 4. The Core Trait Contract

This is the most important interface in the codebase. **Do not change it without updating all implementors.**

```rust
// crates/ai-sentinel-core/src/layer.rs

use async_trait::async_trait;
use crate::types::{CheckRequest, LayerResult, LayerContext, LayerError, Direction};

#[async_trait]
pub trait Layer: Send + Sync {
    /// Unique identifier used in telemetry and audit. e.g. "L1_SANITIZE"
    fn id(&self) -> &'static str;

    /// Human-readable name for logs and error messages.
    fn name(&self) -> &'static str;

    /// Return false to skip this layer at zero cost (disabled or wrong direction).
    fn applies_to(&self, direction: &Direction) -> bool;

    /// Run the layer check.
    /// - Ok(LayerResult::Pass)            → continue to next layer
    /// - Ok(LayerResult::Reject { .. })   → short-circuit, return reject to caller
    /// - Ok(LayerResult::Mutate { .. })   → replace payload, continue
    /// - Err(..)                          → internal fault: log, count, PASS (fail-open)
    async fn check(
        &self,
        req: &CheckRequest,
        ctx: &mut LayerContext,
    ) -> Result<LayerResult, LayerError>;
}
```

**Stub pattern for L3 and L6:**

```rust
pub struct L3IntentGuard;

#[async_trait]
impl Layer for L3IntentGuard {
    fn id(&self) -> &'static str { "L3_INTENT" }
    fn name(&self) -> &'static str { "Semantic intent guard (stub)" }
    fn applies_to(&self, _: &Direction) -> bool { false }  // disabled entirely
    async fn check(&self, _: &CheckRequest, _: &mut LayerContext)
        -> Result<LayerResult, LayerError> { Ok(LayerResult::Pass) }
}
```

---

## 5. Core Types

```rust
// crates/ai-sentinel-core/src/types.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRequest {
    pub direction: Direction,
    pub payload: serde_json::Value,
    pub session_id: Option<String>,
    pub caller_context: CallerContext,
    pub tool_manifest: Option<ToolManifest>,
    pub config_override: Option<LayerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction { Ingress, Egress }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallerContext {
    pub caller_id: String,
    pub caller_type: CallerType,   // n8n | temporal | sdk | unknown
    pub api_key_hash: Option<String>,
    pub ip: Option<String>,
    pub trust_token: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolManifest {
    pub tool_name: String,
    pub tool_args: serde_json::Value,
    pub allowed_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResponse {
    pub status: CheckStatus,
    pub request_id: String,
    pub session_id: Option<String>,
    pub payload: Option<serde_json::Value>,
    pub reject: Option<RejectDetail>,
    pub latency_ms: u64,
    pub layers_ran: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus { Pass, Reject }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectDetail {
    pub layer: String,
    pub code: String,
    pub reason: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity { Low, Medium, High, Critical }

pub enum LayerResult {
    Pass,
    Reject { code: String, reason: String, severity: Severity },
    Mutate { payload: serde_json::Value },
}

pub struct LayerContext {
    pub request_id: String,
    pub session: Option<Box<dyn SessionHandle>>,
    pub telemetry: TelemetryAccumulator,
    pub start_time: std::time::Instant,
}
```

---

## 6. Pipeline Runner

```rust
// crates/ai-sentinel-core/src/pipeline.rs

pub struct Pipeline {
    layers: Vec<Arc<dyn Layer>>,
}

impl Pipeline {
    pub fn new(layers: Vec<Arc<dyn Layer>>) -> Self { Self { layers } }

    pub async fn run(&self, req: CheckRequest, ctx: &mut LayerContext) -> CheckResponse {
        let mut payload = req.payload.clone();
        let mut ran = Vec::new();

        for layer in &self.layers {
            if !layer.applies_to(&req.direction) { continue; }

            let t = std::time::Instant::now();
            match layer.check(&req, ctx).await {
                Ok(LayerResult::Pass) => {
                    ran.push(layer.id().to_string());
                    ctx.telemetry.record_layer(layer.id(), t.elapsed(), None);
                }
                Ok(LayerResult::Mutate { payload: p }) => {
                    payload = p;
                    ran.push(layer.id().to_string());
                    ctx.telemetry.record_layer(layer.id(), t.elapsed(), None);
                }
                Ok(LayerResult::Reject { code, reason, severity }) => {
                    ran.push(layer.id().to_string());
                    ctx.telemetry.record_layer(layer.id(), t.elapsed(), Some(&code));
                    return CheckResponse {
                        status: CheckStatus::Reject,
                        request_id: ctx.request_id.clone(),
                        session_id: req.session_id.clone(),
                        payload: None,
                        reject: Some(RejectDetail { layer: layer.id().to_string(), code, reason, severity }),
                        latency_ms: ctx.start_time.elapsed().as_millis() as u64,
                        layers_ran: ran,
                    };
                }
                Err(e) => {
                    // Internal fault: fail-open, log, count in telemetry
                    tracing::error!(layer = layer.id(), error = %e, "layer internal fault");
                    ctx.telemetry.record_fault(layer.id());
                }
            }
        }

        CheckResponse {
            status: CheckStatus::Pass,
            request_id: ctx.request_id.clone(),
            session_id: req.session_id.clone(),
            payload: Some(payload),
            reject: None,
            latency_ms: ctx.start_time.elapsed().as_millis() as u64,
            layers_ran: ran,
        }
    }
}
```

---

## 7. Project Structure

```
ai-sentinel/
├── Cargo.toml                        ← workspace root, all members
├── Cargo.lock
├── Dockerfile                        ← multi-stage, non-root, <50MB final image
├── docker-compose.yml                ← ai-sentinel + presidio + postgres + redis
├── .env.example                      ← all env vars with defaults documented
├── CLAUDE.md                         ← this file (copy here for Claude Code)
├── README.md
│
├── config/
│   ├── default.toml                  ← all Phase 1 layers on, memory store, stdout telemetry
│   ├── minimal.toml                  ← L0+L1+L7 only, lowest latency
│   └── enterprise.toml               ← all layers, postgres, OTEL, full telemetry
│
├── crates/
│   ├── ai-sentinel-core/                ← traits, types, pipeline engine
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs              ← CheckRequest, CheckResponse, Direction, LayerResult
│   │       ├── layer.rs              ← Layer trait
│   │       ├── pipeline.rs           ← Pipeline::run()
│   │       ├── session.rs            ← SessionStore trait + SessionHandle
│   │       ├── config.rs             ← AI-SentinelConfig, per-layer flags
│   │       └── error.rs
│   │
│   ├── ai-sentinel-layers/              ← one module per layer
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── l0_telemetry.rs       ← TelemetryAccumulator, TelemetryRecord, async writer
│   │       ├── l1_sanitize.rs        ← RegexSet injection, Presidio call, PII fallback
│   │       ├── l2_1_auth.rs          ← JWT + API key validation
│   │       ├── l2_2_trust.rs         ← HMAC trust chain token
│   │       ├── l2_3_threat.rs        ← SignatureSet reader, match logic
│   │       ├── l2_4_mcp.rs           ← MCP env filter (applied at spawn)
│   │       ├── l3_intent.rs          ← STUB pass-through
│   │       ├── l4_authz.rs           ← RBAC, destructive gate, CVE patterns
│   │       ├── l5_sandbox.rs         ← token bucket, cost cap, e-stop
│   │       ├── l6_egress.rs          ← STUB pass-through
│   │       └── l7_audit.rs           ← SHA-256 hash chain, async write, buffer
│   │
│   ├── ai-sentinel-feed/                ← L2.3 threat intel background worker
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── worker.rs             ← background tokio task, poll + webhook trigger
│   │       ├── signature.rs          ← SignatureSet struct, Arc<RwLock<>>, atomic swap
│   │       └── sources/
│   │           ├── crowdsec.rs       ← CrowdSec CTI API client
│   │           ├── nvd.rs            ← NVD API client
│   │           ├── owasp.rs          ← OWASP LLM Top 10 static patterns
│   │           └── custom.rs         ← custom JSON file watcher
│   │
│   ├── ai-sentinel-store/               ← session + audit backends
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── memory.rs             ← DashMap, TTL eviction
│   │       ├── redis.rs              ← deadpool-redis
│   │       └── postgres.rs           ← sqlx, schema migrations
│   │
│   └── ai-sentinel-api/                 ← axum HTTP service (binary crate)
│       └── src/
│           ├── main.rs               ← startup, layer construction, feed worker spawn
│           ├── routes/
│           │   ├── check.rs          ← POST /check (the main endpoint)
│           │   ├── health.rs         ← GET /health, GET /ready
│           │   ├── admin.rs          ← POST /admin/feed/refresh, GET /admin/signatures,
│           │   │                        GET /admin/audit/verify, POST /admin/estop
│           │   └── metrics.rs        ← GET /metrics (Prometheus)
│           ├── middleware/
│           │   └── auth.rs           ← Bearer token validation on all routes
│           └── openapi.rs            ← utoipa spec, GET /openapi.json, GET /docs
│
└── tests/
    └── integration/
        ├── check_ingress.rs
        ├── check_egress.rs
        ├── feed_hotswap.rs           ← load sigs → match → swap to empty → same payload passes
        ├── session_rate_limit.rs     ← exceed limit → verify reject
        └── audit_chain_integrity.rs  ← write 10 records → verify → mutate one → verify fail
```

---

## 8. Dependencies

```toml
# workspace Cargo.toml [workspace.dependencies]
axum            = { version = "0.7", features = ["macros"] }
tokio           = { version = "1", features = ["full"] }
serde           = { version = "1", features = ["derive"] }
serde_json      = "1"
async-trait     = "0.1"
thiserror       = "1"
anyhow          = "1"
uuid            = { version = "1", features = ["v4", "fast-rng"] }
tracing         = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
sha2            = "0.10"
hmac            = "0.12"
jsonwebtoken    = "9"
regex           = "1"
fancy-regex     = "0.13"        # lookaheads for injection patterns
reqwest         = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio-cron-scheduler = "0.11"
dashmap         = "6"
deadpool-redis  = "0.15"
sqlx            = { version = "0.8", features = ["postgres", "runtime-tokio", "tls-rustls", "uuid", "chrono"] }
opentelemetry   = { version = "0.24", features = ["metrics"] }
opentelemetry-otlp = "0.17"
prometheus-client = "0.22"
utoipa          = { version = "4", features = ["axum_extras"] }
utoipa-scalar   = { version = "0.1", features = ["axum"] }
config          = "0.14"
zeroize         = { version = "1", features = ["derive"] }
chrono          = { version = "0.4", features = ["serde"] }
```

---

## 9. Build Order — Execute Exactly In This Sequence

**Rule: `cargo check` must pass after EVERY step before proceeding.**

### Build verification rule for all steps

After writing source files locally, verify each step by running:
```bash
python scripts/deploy_build.py
```
This uploads the changed files and runs `cargo check` on the VM.
Fix all errors before proceeding to the next step.
After step 4, additionally run:
```bash
python scripts/deploy_build.py --release
python scripts/verify_build.py --health
```

### Step 1 — Workspace scaffold

Create `Cargo.toml` workspace root declaring all crate members. Create all crate directories with empty `Cargo.toml` and `src/lib.rs` files. Project must compile (empty) after this step.

### Step 2 — ai-sentinel-core

Implement in this order:
1. `error.rs` — `LayerError` and `AI-SentinelError` with thiserror
2. `types.rs` — all types from section 5 above
3. `layer.rs` — Layer trait from section 4 above
4. `session.rs` — `SessionStore` trait, `SessionHandle` trait, `SessionState` struct
5. `config.rs` — `AI-SentinelConfig` with per-layer toggles and all env var bindings
6. `pipeline.rs` — Pipeline runner from section 6 above
7. `lib.rs` — re-export all public types

### Step 3 — ai-sentinel-store (memory backend only)

Implement `memory.rs`:
- `MemoryStore` wrapping `DashMap<String, SessionState>`
- `SessionState { action_count: u32, cost_usd: f64, last_intent: Option<String>, rate_window_start: Instant, audit_tail_hash: String }`
- TTL eviction: evict sessions not accessed in `AI_SENTINEL_SESSION_TTL_SECS` (default 3600)
- Implement `SessionStore` trait

### Step 4 — ai-sentinel-api skeleton (must produce running binary)

Implement:
1. `main.rs` — read config, construct empty layer vec, build empty Pipeline, start axum server on `AI_SENTINEL_HOST:AI_SENTINEL_PORT`
2. `routes/health.rs` — `GET /health` returns `{"status":"ok"}`, `GET /ready` returns `{"status":"ok"}` (always, for now — update in step 11)
3. `routes/check.rs` — `POST /check` deserialises `CheckRequest`, runs `Pipeline::run()`, serialises `CheckResponse`
4. `middleware/auth.rs` — validate Bearer token against `AI_SENTINEL_API_KEYS` on all routes except `/health`

**After this step: `cargo build --release` must produce a binary. `curl localhost:8742/health` must return `{"status":"ok"}`.**

### Step 5 — L0 Telemetry envelope

In `ai-sentinel-layers/src/l0_telemetry.rs`:
1. `TelemetryAccumulator` — accumulates per-layer timings and fault counts during pipeline run (already in LayerContext)
2. `TelemetryRecord` — all fields listed in section 3 L0 spec
3. `TelemetryWriter` — async write to configured backend (start with stdout JSON only)
4. Wrap `Pipeline::run()` in `ai-sentinel-api/src/routes/check.rs`:
   - Before pipeline: stamp entry (request_id via UUIDv4, timestamp, caller fields)
   - After response sent: `tokio::spawn` the async write task
5. Add verbosity level check: only write fields appropriate to configured level

### Step 6 — L7 Audit hash chain

In `ai-sentinel-layers/src/l7_audit.rs`:
1. `AuditRecord` struct: `record_id, prev_hash, current_hash, request_id, session_id, direction, decision, reject_layer, reject_code, payload_hash, created_at`
2. Hash computation: `current_hash = SHA-256(record_id + prev_hash + timestamp + payload_hash)`
3. Genesis: prev_hash = `"0000000000000000000000000000000000000000000000000000000000000000"`
4. `AuditStore` backed by in-memory buffer (capacity 10,000) for Phase 1 — postgres in step 12
5. Layer implementation: `applies_to` returns true for both directions. In `check()`: compute audit record, spawn async write, return `Ok(LayerResult::Pass)`
6. Add `GET /admin/audit/verify` route: walk buffer, verify each hash, return first failure or pass

Register L7 in pipeline in `main.rs`.

### Step 7 — L1 Input sanitization

In `ai-sentinel-layers/src/l1_sanitize.rs`:
1. Compile `INJECTION_PATTERNS` as a `RegexSet` at struct construction (not per-request)
2. `check()` flow:
   a. Serialize payload to string, match against `INJECTION_PATTERNS` → `Reject(PROMPT_INJECTION)` if match
   b. Estimate token count (chars/4 approximation) → `Reject(TOKEN_BUDGET_EXCEEDED)` if over limit
   c. Call Presidio: `reqwest::Client::post(AI_SENTINEL_PRESIDIO_URL + "/analyze")` with 10ms timeout. On result: if critical entities found → `Reject(PII_CRITICAL)`. If non-critical: `Mutate` with redacted payload.
   d. On Presidio timeout/error: fall back to PII regex patterns (email, SSN, phone, CC, IP)
3. `applies_to`: Ingress only

Register L1 in pipeline before L2 layers.

### Step 8 — L2.1 and L2.2

**L2.1** (`l2_1_auth.rs`):
1. Extract `Authorization: Bearer <token>` from `req.caller_context.api_key_hash` (pre-hashed by caller) and validate against `AI_SENTINEL_API_KEYS` allowlist
2. Also accept JWT: decode with `jsonwebtoken` against `AI_SENTINEL_JWT_SECRET`, validate exp
3. `Reject(UNAUTHORIZED)` if neither valid

**L2.2** (`l2_2_trust.rs`):
1. If `caller_context.trust_token` absent → `Ok(Pass)`
2. If present: parse `{caller_id}.{session_id}.{timestamp}.{hmac}`, validate HMAC-SHA256 against `AI_SENTINEL_TRUST_SECRET`, reject if timestamp > 60s old or caller_id mismatch
3. `Reject(TRUST_CHAIN_INVALID)` or `TRUST_TOKEN_EXPIRED` or `TRUST_CALLER_MISMATCH`

Register both in pipeline after L1.

### Step 9 — ai-sentinel-feed and L2.3

**ai-sentinel-feed crate:**

1. `signature.rs`:
```rust
pub struct SignatureSet {
    pub version: String,
    pub ip_blocklist: HashSet<IpAddr>,
    pub pattern_signatures: Vec<CompiledPattern>,
    pub tool_cve_patterns: Vec<ToolCvePattern>,
    pub provider_advisories: Vec<ProviderAdvisory>,
}
pub struct CompiledPattern {
    pub id: String,
    pub regex: Regex,
    pub severity: Severity,
    pub description: String,
    pub source: String,
}
// Wrap in: Arc<RwLock<SignatureSet>>
```

2. `sources/crowdsec.rs`:
   - GET `https://cti.api.crowdsec.net/v2/smoke/ips` with `X-Api-Key: AI_SENTINEL_CROWDSEC_API_KEY`
   - Filter scenarios containing "ai", "llm", "prompt", "agent", "injection"
   - Build `ip_blocklist` and `pattern_signatures`

3. `sources/nvd.rs`:
   - GET `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=LLM+prompt+injection`
   - Extract CVSS score, description, build patterns from keywords

4. `sources/custom.rs`:
   - Load JSON from `AI_SENTINEL_CUSTOM_FEED_PATH`
   - Schema: `[{id, pattern, severity, description}]`
   - Watch file for changes (notify crate or poll mtime)

5. `worker.rs`:
   - Background `tokio::spawn` task
   - Poll all sources every `AI_SENTINEL_FEED_INTERVAL_SECS` (default 300)
   - Build new `SignatureSet` in scratch buffer
   - `*feed_store.write() = new_set` — atomic swap
   - Listen on `POST /admin/feed/refresh` for immediate trigger (use a `tokio::sync::Notify`)

**L2.3** (`l2_3_threat.rs`):
- Hold `Arc<RwLock<SignatureSet>>` reference (passed at construction)
- `check()`: `let set = store.read()`, run 4 checks in order, release read lock
- `applies_to`: both Ingress and Egress

Spawn feed worker in `main.rs`. Pass `Arc<RwLock<SignatureSet>>` to L2.3 layer.

### Step 10 — L2.4, L4, L5

**L2.4** (`l2_4_mcp.rs`):
- This layer does not intercept the pipeline check directly — it provides a utility function `filter_mcp_env(env: &HashMap<String, String>) -> HashMap<String, String>` that the MCP invocation path calls
- As a pipeline Layer: `applies_to` returns true for Ingress. `check()` scans `payload` for any MCP server spawn commands and validates they would use the filtered env. For Phase 1: return Pass and document the env filter utility.

**L4** (`l4_authz.rs`):
1. If `tool_manifest` absent: `Ok(Pass)` immediately
2. Load RBAC from `AI_SENTINEL_RBAC_PATH` JSON at startup, store in `Arc<RwLock<RbacConfig>>`, reload on SIGHUP
3. Extract caller role from JWT claims or default role
4. Check `tool_manifest.tool_name` against role's `allowed_tools` → `Reject(TOOL_NOT_AUTHORIZED)`
5. Check against destructive tools list (`AI_SENTINEL_DESTRUCTIVE_TOOLS`) → `Reject(DESTRUCTIVE_TOOL_DENIED)`
6. Check against L2.3 `tool_cve_patterns` → `Reject(TOOL_CVE)`
7. Check tool args against `forbidden_args` patterns in RBAC config → `Reject(FORBIDDEN_ARGS)`

**L5** (`l5_sandbox.rs`):
1. Require `session_id` or fall back to `caller_id` as bucket key
2. Load `SessionState` from store (or create default)
3. Token bucket check: `action_count` within window → `Reject(RATE_LIMIT)` if exceeded
4. Cost cap check: `cost_usd` against `AI_SENTINEL_RATE_MAX_COST_PER_DAY` → `Reject(COST_CAP)`
5. Token budget: estimate tokens from payload → `Reject(TOKEN_BUDGET)` if over limit
6. E-stop: check `estop_set: Arc<DashSet<String>>` for session/caller → `Reject(ESTOP)`
7. On pass: increment `action_count`, add `cost_usd`, persist to store

Register all three layers in pipeline.

### Step 11 — L3 and L6 stubs

Implement both exactly using the stub pattern from section 4. Register in pipeline. `applies_to` returns `false` for both — they contribute zero overhead.

Update `GET /ready`: return 200 only if session store connected AND SignatureSet has been loaded at least once.

### Step 12 — ai-sentinel-store: Redis and Postgres backends

**Postgres** (`postgres.rs`):
- Use `sqlx::migrate!()` for schema — create migrations directory with initial schema:

```sql
-- migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS ai-sentinel_sessions (
    session_id    TEXT PRIMARY KEY,
    caller_id     TEXT NOT NULL,
    action_count  INTEGER DEFAULT 0,
    cost_usd      NUMERIC(10,6) DEFAULT 0,
    last_intent   TEXT,
    rate_window   TIMESTAMPTZ,
    audit_hash    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai-sentinel_audit (
    record_id     UUID PRIMARY KEY,
    prev_hash     TEXT NOT NULL,
    current_hash  TEXT NOT NULL,
    request_id    TEXT NOT NULL,
    session_id    TEXT,
    direction     TEXT NOT NULL,
    decision      TEXT NOT NULL,
    reject_layer  TEXT,
    reject_code   TEXT,
    payload_hash  TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON ai-sentinel_audit (session_id);
CREATE INDEX ON ai-sentinel_audit (created_at);

CREATE TABLE IF NOT EXISTS ai-sentinel_telemetry (
    request_id         TEXT PRIMARY KEY,
    session_id         TEXT,
    direction          TEXT,
    decision           TEXT,
    reject_layer       TEXT,
    reject_code        TEXT,
    latency_ms         INTEGER,
    layers_ran         TEXT[],
    model              TEXT,
    provider           TEXT,
    prompt_tokens      INTEGER,
    completion_tokens  INTEGER,
    cost_usd           NUMERIC(10,6),
    caller_id          TEXT,
    caller_type        TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

- Connect to `AI_SENTINEL_DATABASE_URL`
- Run migrations at startup
- Implement `SessionStore` trait
- Update L7 audit to write to `ai-sentinel_audit` table when postgres backend active
- Update L0 telemetry to write to `ai-sentinel_telemetry` when postgres backend active

**Redis** (`redis.rs`):
- deadpool-redis pool from `AI_SENTINEL_REDIS_URL`
- Key pattern: `ai-sentinel:session:{session_id}`
- JSON serialize/deserialize `SessionState`
- TTL set on every write: `AI_SENTINEL_SESSION_TTL_SECS`
- Implement `SessionStore` trait

### Step 13 — Remaining routes and Prometheus metrics

**Admin routes** (`routes/admin.rs`):
- `POST /admin/feed/refresh` — trigger `feed_notify.notify_one()`
- `GET /admin/signatures` — return `{version, ip_count, pattern_count, tool_cve_count, advisory_count, last_updated}`
- `GET /admin/audit/verify` — walk audit chain, return `{status: "ok"}` or `{status: "fail", record_id, expected_hash, actual_hash}`
- `POST /admin/estop` — add `{session_id or caller_id}` to `estop_set`
- `POST /admin/estop/lift` — remove from `estop_set`

All admin routes require `AI_SENTINEL_ADMIN_TOKEN` (separate from API keys).

**Prometheus metrics** (`routes/metrics.rs`):
```
ai-sentinel_requests_total{direction,status}          counter
ai-sentinel_request_duration_ms                       histogram (buckets: 1,5,10,25,50,100,250,500)
ai-sentinel_layer_duration_ms{layer}                  histogram
ai-sentinel_rejects_total{layer,code}                 counter
ai-sentinel_layer_faults_total{layer}                 counter
ai-sentinel_feed_last_updated_timestamp               gauge
ai-sentinel_feed_signature_count{source}              gauge
ai-sentinel_session_count                             gauge
ai-sentinel_rate_limit_hits_total{caller_id}          counter
ai-sentinel_cost_cap_hits_total{caller_id}            counter
```

**OpenAPI** (`openapi.rs`):
- Use `utoipa` to annotate all route handlers
- `GET /openapi.json` — serve spec
- `GET /docs` — serve Scalar UI

### Step 14 — Dockerfile and docker-compose.yml

**Dockerfile:**

```dockerfile
# Stage 1: builder
FROM rust:1.77-slim AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
RUN cargo build --release --locked --bin ai-sentinel-api

# Stage 2: runtime
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN groupadd -r ai-sentinel && useradd -r -g ai-sentinel -u 65534 ai-sentinel
COPY --from=builder /build/target/release/ai-sentinel-api /usr/local/bin/ai-sentinel
USER 65534
EXPOSE 8742
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8742/health || exit 1
CMD ["ai-sentinel"]
```

Final image must be < 50MB. Verify with `docker images ai-sentinel`.

**docker-compose.yml:**

```yaml
version: "3.9"
services:
  ai-sentinel:
    build: .
    restart: unless-stopped
    env_file: .env
    ports: ["8742:8742"]
    depends_on:
      postgres: { condition: service_healthy }
      presidio-analyzer: { condition: service_started }
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ai-sentinel.rule=Host(`ai-sentinel.on-nex.us`)"
      - "traefik.http.routers.ai-sentinel.tls=true"
      - "traefik.http.routers.ai-sentinel.tls.certresolver=dns-cloudflare"
      - "traefik.http.services.ai-sentinel.loadbalancer.server.port=8742"
    networks: [ai-sentinel-net, traefik-public]

  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
    restart: unless-stopped
    ports: ["5002:5002"]
    networks: [ai-sentinel-net]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ai-sentinel
      POSTGRES_USER: ai-sentinel
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ai-sentinel"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [ai-sentinel-net]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks: [ai-sentinel-net]

volumes:
  postgres_data:

networks:
  ai-sentinel-net:
  traefik-public:
    external: true
```

### Step 15 — Integration tests

Required tests in `tests/integration/`:

**check_ingress.rs:**
- Full ingress check passes with clean payload
- Ingress check rejects on injection pattern
- Ingress check rejects on missing auth token
- Ingress check rejects tool not in manifest
- Ingress check passes for tool in manifest
- L1 mutates payload when PII detected (not reject)

**check_egress.rs:**
- Full egress check passes with clean output
- Egress check skips L1, L4, L5 (direction filtering)
- L7 fires on egress

**feed_hotswap.rs:**
- Load SignatureSet with one pattern that matches test payload
- Send test payload → verify reject
- Atomic swap to empty SignatureSet
- Send same payload → verify pass (zero restart, no sleep needed)

**session_rate_limit.rs:**
- Send requests until `RATE_LIMIT` reject
- Verify exact count matches configured limit
- Verify different session_id has independent bucket

**audit_chain_integrity.rs:**
- Write 10 audit records via pipeline runs
- Call `GET /admin/audit/verify` → expect pass
- Directly mutate one record in store (change reject_code)
- Call `GET /admin/audit/verify` → expect fail at that record_id

---

## 10. Environment Variable Reference

```bash
# Server
AI_SENTINEL_HOST=0.0.0.0
AI_SENTINEL_PORT=8742
AI_SENTINEL_LOG_LEVEL=info
AI_SENTINEL_CONFIG_PATH=config/default.toml

# Authentication
AI_SENTINEL_JWT_SECRET=                    # required for JWT auth
AI_SENTINEL_API_KEYS=                      # comma-separated SHA-256 hashes
AI_SENTINEL_ADMIN_TOKEN=                   # required for /admin/* routes
AI_SENTINEL_TRUST_SECRET=                  # required for L2.2 chain tokens

# Session store
AI_SENTINEL_STORE_BACKEND=memory           # memory | redis | postgres
AI_SENTINEL_DATABASE_URL=                  # postgres://user:pass@host/db
AI_SENTINEL_REDIS_URL=                     # redis://host:6379
AI_SENTINEL_SESSION_TTL_SECS=3600

# Telemetry (L0)
AI_SENTINEL_TELEMETRY_LEVEL=standard       # off | minimal | standard | full | debug
AI_SENTINEL_TELEMETRY_BACKEND=stdout       # stdout | file | postgres | otel | multi
AI_SENTINEL_TELEMETRY_PII_REDACT=true
AI_SENTINEL_TELEMETRY_FILE_PATH=           # required if backend=file

# Threat feed (L2.3)
AI_SENTINEL_FEED_INTERVAL_SECS=300
AI_SENTINEL_CROWDSEC_API_KEY=              # required for CrowdSec source
AI_SENTINEL_NVD_API_KEY=                   # optional, higher rate limit
AI_SENTINEL_CUSTOM_FEED_PATH=              # path to custom signatures JSON

# Rate limits (L5)
AI_SENTINEL_RATE_MAX_ACTIONS_PER_HOUR=1000
AI_SENTINEL_RATE_MAX_COST_PER_DAY=100.0
AI_SENTINEL_RATE_MAX_TOKENS_PER_REQUEST=100000

# PII detection (L1)
AI_SENTINEL_PRESIDIO_URL=http://presidio-analyzer:5002
AI_SENTINEL_PRESIDIO_TIMEOUT_MS=10

# Tool authorization (L4)
AI_SENTINEL_RBAC_PATH=                     # path to RBAC roles JSON
AI_SENTINEL_DESTRUCTIVE_TOOLS=delete,drop,rm,truncate,format

# Layer toggles (all default true except L3/L6 which are stubs)
AI_SENTINEL_LAYER_L1_ENABLED=true
AI_SENTINEL_LAYER_L2_1_ENABLED=true
AI_SENTINEL_LAYER_L2_2_ENABLED=true
AI_SENTINEL_LAYER_L2_3_ENABLED=true
AI_SENTINEL_LAYER_L3_ENABLED=false
AI_SENTINEL_LAYER_L4_ENABLED=true
AI_SENTINEL_LAYER_L5_ENABLED=true
AI_SENTINEL_LAYER_L6_ENABLED=false
AI_SENTINEL_LAYER_L7_ENABLED=true

# Postgres credentials (for docker-compose)
POSTGRES_PASSWORD=changeme_in_production
```

---

## 11. Rejection Code Reference

| Layer | Code | Trigger |
|---|---|---|
| L1 | `PROMPT_INJECTION` | Payload matches injection RegexSet |
| L1 | `TOKEN_BUDGET_EXCEEDED` | Estimated tokens > AI_SENTINEL_RATE_MAX_TOKENS_PER_REQUEST |
| L1 | `PII_CRITICAL` | Presidio/regex detects critical PII (e.g. credential strings) |
| L2.1 | `UNAUTHORIZED` | No valid JWT or API key |
| L2.2 | `TRUST_CHAIN_INVALID` | HMAC signature invalid |
| L2.2 | `TRUST_TOKEN_EXPIRED` | Token timestamp > 60s old |
| L2.2 | `TRUST_CALLER_MISMATCH` | Token caller_id != request caller_id |
| L2.3 | `IP_BLOCKLIST` | caller_context.ip in SignatureSet.ip_blocklist |
| L2.3 | `CVE_SIGNATURE_MATCH` | Payload matches a pattern_signature |
| L2.3 | `TOOL_CVE` | Tool invocation matches tool_cve_pattern |
| L2.3 | `PROVIDER_ADVISORY` | Target model/provider has open advisory AND block_on_advisory=true |
| L3 | `INTENT_DRIFT` | Semantic similarity below threshold (Phase 2) |
| L4 | `TOOL_NOT_AUTHORIZED` | Tool not in caller's RBAC allowed list |
| L4 | `DESTRUCTIVE_TOOL_DENIED` | Tool in destructive list, no explicit allow |
| L4 | `TOOL_CVE` | Tool invocation matches L2.3 CVE pattern |
| L4 | `FORBIDDEN_ARGS` | Tool args match forbidden_args pattern in RBAC |
| L5 | `RATE_LIMIT` | Action count exceeds hourly limit |
| L5 | `COST_CAP` | Cumulative cost exceeds daily cap |
| L5 | `TOKEN_BUDGET` | Per-request token estimate exceeds limit |
| L5 | `ESTOP` | Session or caller in active e-stop set |
| L6 | `SSRF_URL` | Output contains private/metadata IP URL (Phase 2) |
| L6 | `EXFILTRATION_PATTERN` | Output matches exfiltration pattern (Phase 2) |
| L6 | `PII_EGRESS` | Output contains PII (Phase 2) |

---

## 12. API Contract — POST /check

**Request:**
```json
POST /check
Authorization: Bearer <api_key_or_jwt>
Content-Type: application/json

{
  "direction": "ingress",
  "payload": { "messages": [{"role": "user", "content": "..."}] },
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "caller_context": {
    "caller_id": "n8n-workflow-sales-001",
    "caller_type": "n8n",
    "ip": "10.0.1.45",
    "trust_token": "n8n-workflow-sales-001.550e8400....1711234567.hmac",
    "model": "claude-opus-4-6",
    "provider": "anthropic",
    "prompt_tokens": 1200,
    "completion_tokens": 0,
    "cost_usd": 0.018
  },
  "tool_manifest": {
    "tool_name": "bash",
    "tool_args": { "command": "ls /workspace" },
    "allowed_tools": ["bash", "read_file", "web_search"]
  }
}
```

**Pass response:**
```json
{
  "status": "pass",
  "request_id": "01HXYZ...",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": { "messages": [{"role": "user", "content": "[PII_REDACTED]"}] },
  "reject": null,
  "latency_ms": 4,
  "layers_ran": ["L1_SANITIZE", "L2_1_AUTH", "L2_2_TRUST", "L2_3_THREAT", "L4_AUTHZ", "L5_SANDBOX"]
}
```

**Reject response:**
```json
{
  "status": "reject",
  "request_id": "01HXYZ...",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": null,
  "reject": {
    "layer": "L2_3_THREAT",
    "code": "CVE_SIGNATURE_MATCH",
    "reason": "Payload matches CVE-2025-1234: LLM prompt override via system field injection",
    "severity": "high"
  },
  "latency_ms": 2,
  "layers_ran": ["L1_SANITIZE", "L2_1_AUTH", "L2_2_TRUST", "L2_3_THREAT"]
}
```

---

## 13. RBAC Roles JSON Schema

```json
{
  "roles": {
    "n8n_standard": {
      "allowed_tools": ["web_search", "read_file", "write_file", "bash"],
      "forbidden_args": {
        "bash": ["rm -rf", "sudo", "curl.*|.*sh"]
      },
      "destructive_override": false
    },
    "temporal_worker": {
      "allowed_tools": ["read_file", "write_file", "database_query"],
      "forbidden_args": {},
      "destructive_override": false
    },
    "admin_agent": {
      "allowed_tools": ["*"],
      "forbidden_args": {},
      "destructive_override": true
    }
  },
  "default_role": "n8n_standard"
}
```

---

## 14. Phase 2 Roadmap (Do Not Build in Phase 1)

These are documented here for completeness. Claude Code: **do not implement these in Phase 1.** The stubs are sufficient.

**L3 Semantic Intent Guard (full implementation):**
- Local embedding model (e.g., nomic-embed-text via Ollama) or configurable embedding API
- Session baseline: embed declared intent at session start, store vector in Postgres/pgvector
- Per-call: embed incoming payload, compute cosine similarity against baseline
- Configurable threshold: below threshold → HOLD (webhook notification) or INTENT_DRIFT reject
- Drift score exported via L0 telemetry and Prometheus gauge

**L6 Output Inspection (full implementation):**
- SSRF URL scanner: parse all URLs in output, reject private ranges (RFC1918, RFC4193, 169.254.x.x, ::1)
- Exfiltration pattern detection: regex patterns for common data theft signatures
- Egress PII scan: call Presidio on outbound payload with 10ms timeout
- Fallback regex for PII on Presidio timeout

**Additional Phase 2 items:**
- OpenFang-style information flow taint tracking (secret labels through execution)
- Ed25519 signed agent manifests for cryptographic identity
- Full OFP-style P2P mutual authentication for agent-to-agent calls
- L3 behavioral drift alerting via webhook to configured endpoint

---

## 15. Security Design Principles

**Fail-open on layer fault.** `Err(..)` from any layer = log + count + Pass. A misconfigured layer does not take down the entire agent pipeline. Monitor `ai-sentinel_layer_faults_total` and alarm on it.

**Zero-restart CVE updates.** The L2.3 atomic SignatureSet swap is the critical property. Never block readers. Writer builds in scratch, swaps pointer, done. Active within configured interval.

**Separation of concerns across layers.** L0=observability. L1=syntactic input. L2=trust+identity. L3=semantic intent. L4=authorization. L5=resource governance. L6=egress safety. L7=audit integrity. No layer reaches into another's concern.

**Async-only for audit and telemetry.** L7 and L0 exit writes never block the response path. Always `tokio::spawn` after response is sent.

**PII strip before store.** Both L0 and L7 must run PII stripping before writing to any backend when `AI_SENTINEL_TELEMETRY_PII_REDACT=true`. L0 runs its own strip because it records the payload before L1 has had a chance to clean it.

---

## 16. Verification Checklist

Before declaring Phase 1 complete, run:
```bash
python scripts/verify_build.py --checklist
```
This runs all checks below against the live VM. All must pass.

- [ ] `python scripts/deploy_build.py --release` succeeds (binary built on VM)
- [ ] `python scripts/verify_build.py --health` returns `{"status":"ok"}`
- [ ] `python scripts/deploy_containers.py --up` starts all containers
- [ ] `python scripts/deploy_containers.py --status` shows all containers running
- [ ] `python scripts/verify_build.py --all-tests` passes all integration tests
- [ ] Injection payload is rejected by L1 before reaching agent
- [ ] Clean payload passes all layers and reaches agent
- [ ] Tool not in allowed_tools is rejected by L4
- [ ] 1001st request in same session is rejected by L5 with RATE_LIMIT
- [ ] New signature loaded → matching payload rejected → signature cleared → same payload passes (zero restart)
- [ ] `GET /admin/audit/verify` returns pass on clean chain
- [ ] `GET /admin/audit/verify` returns fail after chain mutation
- [ ] `GET /metrics` returns Prometheus format
- [ ] Docker image runs as uid 65534 (non-root)
- [ ] `docker-compose up` starts all services, ai-sentinel reachable at ai-sentinel.on-nex.us

---

*AI-Sentinel — AI Security Protection Module*
*Onnex · Las Vegas, Nevada · v1.0 · March 2026 · CONFIDENTIAL*

---

# PART C — Deploy Scripts
### Save each block as the named file in `scripts/`

## scripts/_config.py

```python
# scripts/_config.py
# Shared config for all AI-Sentinel deploy/build scripts.
# Update VM_HOST, VM_USER, VM_PASS before first run.

VM_HOST     = "BUILD_VM_IP"      # e.g. "10.10.110.50"
VM_USER     = "BUILD_VM_USER"    # e.g. "root" or "ubuntu"
VM_PASS     = "BUILD_VM_PASS"    # set to None if using key auth
SSH_KEY     = None               # e.g. r"C:\Users\mrtma\.ssh\id_rsa" or None
VM_PORT     = 22
REMOTE_ROOT = "/opt/ai-sentinel"

# Timeout for long operations (cargo build --release can take 5-10 min cold)
SHORT_TIMEOUT = 60
BUILD_TIMEOUT = 600
TEST_TIMEOUT  = 300

# Local source root (relative to this script's location)
import os
LOCAL_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))

# Directories to sync to VM (relative paths from LOCAL_ROOT)
SYNC_DIRS = [
    "crates",
    "config",
    "tests",
]
SYNC_FILES = [
    "Cargo.toml",
    "Cargo.lock",
]

# Files/dirs to never upload
EXCLUDE_PATTERNS = [
    "target",
    "__pycache__",
    ".git",
    "*.pyc",
    ".env",
]
```

---

## scripts/deploy_build.py

```python
#!/usr/bin/env python3
"""
scripts/deploy_build.py

Uploads AI-Sentinel source to the build VM and runs cargo check or cargo build.

Usage:
    python scripts/deploy_build.py                  # upload + cargo check
    python scripts/deploy_build.py --release        # upload + cargo build --release
    python scripts/deploy_build.py --check-only     # cargo check without upload
    python scripts/deploy_build.py --upload-only    # upload without building

This is the primary development loop script. Run it after editing source files.
"""

import argparse
import os
import sys
import fnmatch
import paramiko
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from _config import (
    VM_HOST, VM_USER, VM_PASS, SSH_KEY, VM_PORT, REMOTE_ROOT,
    SHORT_TIMEOUT, BUILD_TIMEOUT, LOCAL_ROOT,
    SYNC_DIRS, SYNC_FILES, EXCLUDE_PATTERNS,
)


def should_exclude(path: str) -> bool:
    name = os.path.basename(path)
    for pattern in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(name, pattern):
            return True
    return False


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if SSH_KEY:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       key_filename=SSH_KEY, timeout=30)
    else:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       password=VM_PASS, timeout=30)
    print(f"  Connected to {VM_USER}@{VM_HOST}:{VM_PORT}")
    return client


def run_cmd(client: paramiko.SSHClient, cmd: str, timeout: int = SHORT_TIMEOUT,
            label: str = "") -> int:
    """Run a command on the VM, stream output, return exit code."""
    full_cmd = f"source ~/.cargo/env && {cmd}"
    if label:
        print(f"\n[{label}] {cmd}")
    else:
        print(f"\n$ {cmd}")

    _, stdout, stderr = client.exec_command(full_cmd, timeout=timeout, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)
    exit_code = stdout.channel.recv_exit_status()
    if exit_code != 0:
        print(stderr.read().decode(), file=sys.stderr)
    return exit_code


def sftp_upload_dir(sftp: paramiko.SFTPClient, local_dir: str, remote_dir: str) -> int:
    """Recursively upload a local directory to the remote VM. Returns file count."""
    count = 0
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"

        if should_exclude(local_path):
            continue

        if os.path.isdir(local_path):
            count += sftp_upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            count += 1

    return count


def upload(client: paramiko.SSHClient) -> None:
    print("\n── Uploading source to VM ──────────────────────────────")
    sftp = client.open_sftp()

    # Ensure remote root exists
    try:
        sftp.stat(REMOTE_ROOT)
    except FileNotFoundError:
        run_cmd(client, f"mkdir -p {REMOTE_ROOT}")

    total = 0

    # Upload top-level files
    for filename in SYNC_FILES:
        local_path = os.path.join(LOCAL_ROOT, filename)
        if os.path.exists(local_path):
            remote_path = f"{REMOTE_ROOT}/{filename}"
            sftp.put(local_path, remote_path)
            total += 1
            print(f"  ↑ {filename}")

    # Upload directories
    for dirname in SYNC_DIRS:
        local_path = os.path.join(LOCAL_ROOT, dirname)
        if os.path.isdir(local_path):
            remote_path = f"{REMOTE_ROOT}/{dirname}"
            n = sftp_upload_dir(sftp, local_path, remote_path)
            total += n
            print(f"  ↑ {dirname}/ ({n} files)")

    sftp.close()
    print(f"\n  Total: {total} files uploaded to {REMOTE_ROOT}")


def build_check(client: paramiko.SSHClient) -> int:
    print("\n── Running cargo check ─────────────────────────────────")
    return run_cmd(
        client,
        f"cd {REMOTE_ROOT} && cargo check 2>&1",
        timeout=SHORT_TIMEOUT,
        label="cargo check",
    )


def build_release(client: paramiko.SSHClient) -> int:
    print("\n── Running cargo build --release ───────────────────────")
    print("  (This takes 5-10 minutes on first cold compile)")
    return run_cmd(
        client,
        f"cd {REMOTE_ROOT} && cargo build --release --locked 2>&1",
        timeout=BUILD_TIMEOUT,
        label="cargo build --release",
    )


def main():
    parser = argparse.ArgumentParser(description="Deploy AI-Sentinel source and build on VM")
    parser.add_argument("--release", action="store_true",
                        help="Run cargo build --release instead of cargo check")
    parser.add_argument("--check-only", action="store_true",
                        help="Skip upload, just run cargo check")
    parser.add_argument("--upload-only", action="store_true",
                        help="Upload source but skip build")
    args = parser.parse_args()

    print(f"\nAI-Sentinel deploy_build.py")
    print(f"  Target: {VM_USER}@{VM_HOST}:{REMOTE_ROOT}")
    print(f"  Mode:   {'check-only' if args.check_only else 'upload-only' if args.upload_only else 'release' if args.release else 'check'}")

    client = connect()
    try:
        if not args.check_only:
            upload(client)

        if not args.upload_only:
            if args.release:
                rc = build_release(client)
            else:
                rc = build_check(client)

            if rc != 0:
                print(f"\n✗ Build failed (exit code {rc})")
                sys.exit(rc)
            else:
                print(f"\n✓ Build succeeded")
    finally:
        client.close()


if __name__ == "__main__":
    main()
```

---

## scripts/deploy_containers.py

```python
#!/usr/bin/env python3
"""
scripts/deploy_containers.py

Start, stop, and check AI-Sentinel containers on the build VM.

Usage:
    python scripts/deploy_containers.py --up         # docker compose up -d
    python scripts/deploy_containers.py --down       # docker compose down
    python scripts/deploy_containers.py --logs       # tail logs (30 lines)
    python scripts/deploy_containers.py --status     # show container status
    python scripts/deploy_containers.py --restart ai-sentinel   # restart one service
"""

import argparse
import os
import sys
import paramiko

sys.path.insert(0, os.path.dirname(__file__))
from _config import (
    VM_HOST, VM_USER, VM_PASS, SSH_KEY, VM_PORT,
    REMOTE_ROOT, SHORT_TIMEOUT, BUILD_TIMEOUT,
)

COMPOSE_DIR = f"{REMOTE_ROOT}/infra"
COMPOSE_CMD = f"docker compose -f {COMPOSE_DIR}/docker-compose.yml --env-file {COMPOSE_DIR}/env/.env"


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if SSH_KEY:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       key_filename=SSH_KEY, timeout=30)
    else:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       password=VM_PASS, timeout=30)
    print(f"  Connected to {VM_USER}@{VM_HOST}")
    return client


def run_cmd(client, cmd, timeout=SHORT_TIMEOUT, label=""):
    if label:
        print(f"\n[{label}]")
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)
    exit_code = stdout.channel.recv_exit_status()
    if exit_code != 0:
        err = stderr.read().decode()
        if err.strip():
            print(err, file=sys.stderr)
    return exit_code


def main():
    parser = argparse.ArgumentParser(description="Manage AI-Sentinel containers on VM")
    parser.add_argument("--up", action="store_true", help="Start all containers")
    parser.add_argument("--down", action="store_true", help="Stop all containers")
    parser.add_argument("--logs", action="store_true", help="Show recent logs")
    parser.add_argument("--status", action="store_true", help="Show container status")
    parser.add_argument("--restart", metavar="SERVICE", help="Restart a specific service")
    parser.add_argument("--build", action="store_true",
                        help="Rebuild Docker images before starting (use after --release build)")
    args = parser.parse_args()

    client = connect()
    try:
        if args.up:
            if args.build:
                run_cmd(client, f"{COMPOSE_CMD} build", timeout=BUILD_TIMEOUT, label="docker compose build")
            run_cmd(client, f"{COMPOSE_CMD} up -d", label="docker compose up")

        elif args.down:
            run_cmd(client, f"{COMPOSE_CMD} down", label="docker compose down")

        elif args.logs:
            run_cmd(client, f"{COMPOSE_CMD} logs --tail=50 2>&1", label="logs")

        elif args.status:
            run_cmd(client, f"{COMPOSE_CMD} ps", label="container status")

        elif args.restart:
            run_cmd(client, f"{COMPOSE_CMD} restart {args.restart}",
                    label=f"restart {args.restart}")

        else:
            parser.print_help()

    finally:
        client.close()


if __name__ == "__main__":
    main()
```

---

## scripts/verify_build.py

```python
#!/usr/bin/env python3
"""
scripts/verify_build.py

Run integration tests on the build VM and stream results back to Windows.

Usage:
    python scripts/verify_build.py                  # run all integration tests
    python scripts/verify_build.py --test feed_hotswap     # run one test
    python scripts/verify_build.py --health         # just hit /health endpoint
    python scripts/verify_build.py --checklist      # run verification checklist
"""

import argparse
import os
import sys
import paramiko

sys.path.insert(0, os.path.dirname(__file__))
from _config import (
    VM_HOST, VM_USER, VM_PASS, SSH_KEY, VM_PORT,
    REMOTE_ROOT, TEST_TIMEOUT, SHORT_TIMEOUT,
)


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if SSH_KEY:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       key_filename=SSH_KEY, timeout=30)
    else:
        client.connect(VM_HOST, port=VM_PORT, username=VM_USER,
                       password=VM_PASS, timeout=30)
    return client


def run_cmd(client, cmd, timeout=SHORT_TIMEOUT):
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(
        f"source ~/.cargo/env && {cmd}", timeout=timeout, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)
    exit_code = stdout.channel.recv_exit_status()
    if exit_code != 0:
        err = stderr.read().decode()
        if err.strip():
            print(err, file=sys.stderr)
    return exit_code


# The verification checklist from CLAUDE.md section 16
CHECKLIST = [
    ("Binary exists",
     f"test -f {REMOTE_ROOT}/target/release/ai-sentinel-api && echo 'PASS' || echo 'FAIL'"),
    ("Health endpoint",
     "curl -sf http://localhost:8742/health | grep -q ok && echo 'PASS' || echo 'FAIL'"),
    ("Ready endpoint",
     "curl -sf http://localhost:8742/ready | grep -q ok && echo 'PASS' || echo 'FAIL'"),
    ("Metrics endpoint",
     "curl -sf http://localhost:8742/metrics | head -5"),
    ("Docker non-root",
     "docker inspect ai-sentinel | python3 -c \"import sys,json; u=json.load(sys.stdin)[0]['Config']['User']; print('PASS' if u=='65534' else f'FAIL (got {u})')\""),
    ("All containers up",
     "docker compose -f /opt/ai-sentinel/infra/docker-compose.yml ps --format json | python3 -c \"import sys,json; [print(c['Name'], c['State']) for c in json.load(sys.stdin)]\""),
]


def run_checklist(client):
    print("\n── Verification checklist ──────────────────────────────")
    passed = 0
    failed = 0
    for label, cmd in CHECKLIST:
        print(f"\n  {label}")
        rc = run_cmd(client, cmd)
        if rc == 0:
            passed += 1
        else:
            failed += 1
    print(f"\n  Result: {passed} passed, {failed} failed")
    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Run AI-Sentinel verification on VM")
    parser.add_argument("--test", metavar="NAME", help="Run a specific integration test")
    parser.add_argument("--all-tests", action="store_true", help="Run all integration tests")
    parser.add_argument("--health", action="store_true", help="Hit /health endpoint only")
    parser.add_argument("--checklist", action="store_true",
                        help="Run the section 16 verification checklist")
    args = parser.parse_args()

    client = connect()
    try:
        if args.health:
            rc = run_cmd(client, "curl -sf http://localhost:8742/health")
            sys.exit(rc)

        elif args.checklist:
            ok = run_checklist(client)
            sys.exit(0 if ok else 1)

        elif args.test:
            rc = run_cmd(
                client,
                f"cd {REMOTE_ROOT} && cargo test {args.test} -- --nocapture 2>&1",
                timeout=TEST_TIMEOUT,
            )
            sys.exit(rc)

        elif args.all_tests:
            rc = run_cmd(
                client,
                f"cd {REMOTE_ROOT} && cargo test 2>&1",
                timeout=TEST_TIMEOUT,
            )
            sys.exit(rc)

        else:
            parser.print_help()

    finally:
        client.close()


if __name__ == "__main__":
    main()
```

---

# PART D — Project Context
### Save as `context/project-context.md`

# AI-Sentinel — Project Context

## Project identity

- **Project name:** AI-Sentinel (ai-sentinel)
- **Local path (Windows):** `D:\Code\gitlab.botonomy.xyz\claude-workspace-pro\projects\ai-sentinel\`
- **Remote path (VM):** `/opt/ai-sentinel/`
- **Remote project name:** `ai-sentinel`

## Build VM

- **Host:** `BUILD_VM_IP` ← replace with actual IP before first run
- **User:** `BUILD_VM_USER` ← replace with actual user (e.g. root or ubuntu)
- **Password:** `BUILD_VM_PASS` ← replace, or set SSH_KEY_PATH below
- **SSH key:** `SSH_KEY_PATH` ← set to None if using password auth
- **Port:** 22

These values are read by all scripts in `scripts/`. Update them once in
`scripts/_config.py` and all scripts inherit them automatically.

## Remote directory layout (on VM)

```
/opt/ai-sentinel/
├── Cargo.toml
├── Cargo.lock
├── crates/
│   ├── ai-sentinel-core/
│   ├── ai-sentinel-layers/
│   ├── ai-sentinel-feed/
│   ├── ai-sentinel-store/
│   └── ai-sentinel-api/
├── config/
│   ├── default.toml
│   ├── minimal.toml
│   └── enterprise.toml
├── infra/
│   ├── docker-compose.yml
│   └── env/
│       └── .env
├── tests/
└── target/               ← build artifacts, gitignored
```

## Build methodology

Same pattern as AI-OS-POC:

1. Claude Code (Windows) edits source files locally
2. `scripts/deploy_build.py` uses paramiko SFTP to upload changed source to VM
3. Same script SSHs into VM and runs `cargo check` or `cargo build --release`
4. `scripts/deploy_containers.py` runs `docker compose` on the VM
5. `scripts/verify_build.py` runs integration tests on the VM

**No CI/CD pipeline. No GitLab runner for builds.**
GitLab is version control only. All builds go direct Windows → VM via paramiko.

## VM prerequisites (one-time setup)

```bash
# Run these on the VM before first deploy
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
echo 'source ~/.cargo/env' >> ~/.bashrc
source ~/.cargo/env

apt update && apt install -y docker.io docker-compose-v2 git curl pkg-config libssl-dev
usermod -aG docker $USER

mkdir -p /opt/ai-sentinel
```

## Known gotchas

- `source ~/.cargo/env` must be part of every SSH command — cargo is not in PATH by default
- Use full command chains: `source ~/.cargo/env && cd /opt/ai-sentinel && cargo check`
- Docker commands need `docker compose` (v2, space not hyphen) not `docker-compose`
- The Presidio container pulls from mcr.microsoft.com — needs internet access on VM
- `cargo build --release` takes 5-10 minutes on first run (cold compile) — paramiko timeout must be set high (600s)

---

*AI-Sentinel Master Build Document · Onnex · Las Vegas, Nevada · v1.0 · March 2026 · CONFIDENTIAL*
