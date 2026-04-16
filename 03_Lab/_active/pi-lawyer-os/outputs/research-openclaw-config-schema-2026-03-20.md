# Research: OpenClaw AI Agent Platform Configuration Schema

**Date:** 2026-03-20
**Mode:** Standard
**Vertical:** Internal / Onnex Infrastructure
**Primary Question:** What is the OpenClaw configuration schema for agent identity, system prompts, and model configuration?
**Decision It Informs:** Configuring OpenClaw gateway for Onnex AI agent deployment

---

## Key Findings

1. **Agent identity is configured via `identity` object in `agents.list[]`** — Fields are `name`, `theme`, `emoji`, `avatar`. The `name` field sets the display name used for @mentions. Confidence: High

2. **System prompts are NOT configured via a config field** — OpenClaw uses workspace markdown files (`SOUL.md`, `IDENTITY.md`, `USER.md`) that are automatically injected into every agent run. No `systemPrompt` field exists in `openclaw.json`. Confidence: High

3. **`openrouter/auto` IS a valid model string** — After a fix in issue #5395, the format `openrouter/auto` works correctly. The alternative `openrouter/openrouter/auto` also works but is redundant. Confidence: High

4. **Profiles are implemented via `agents.list[]` array** — Each entry in the list is effectively a "profile" with its own `id`, `identity`, `workspace`, and configuration. Multi-agent setups use `bindings` for channel routing. Confidence: High

5. **OpenRouter integration is built-in** — Just set `OPENROUTER_API_KEY` in `env` and reference models as `openrouter/<provider>/<model>` (e.g., `openrouter/anthropic/claude-sonnet-4-5`). Confidence: High

---

## Analysis

### 1. Agent Identity/Name Configuration

The agent identity is configured in two places:

**In `openclaw.json` under `identity` (top-level) or `agents.list[].identity`:**

```json5
{
  identity: {
    name: "Samantha",
    theme: "helpful sloth",
    emoji: "🦥",
    avatar: "avatars/sam.png"
  }
}
```

**Or per-agent in `agents.list[]`:**

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        identity: {
          name: "OpenClaw",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/openclaw.png"
        }
      }
    ]
  }
}
```

**CLI method:**
```bash
openclaw agents set-identity --agent main --name "MyAgent" --emoji "🤖" --theme "helpful assistant"
```

**Supported fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name, used for @mentions in groups |
| `theme` | string | Personality descriptor injected into system prompt |
| `emoji` | string | Unicode emoji representation (default: 👀) |
| `avatar` | string | Workspace path, URL, or data URI |

---

### 2. System Prompt / Persona / Soul Configuration

**OpenClaw does NOT use a `systemPrompt` config field.** Instead, it uses workspace markdown files:

| File | Purpose |
|------|---------|
| `SOUL.md` | Core personality, values, behavioral guardrails |
| `IDENTITY.md` | Persona details, relationship dynamics |
| `USER.md` | User preferences, communication style |
| `AGENTS.md` | Agent-specific instructions |
| `MEMORY.md` | Persistent memory across sessions |

**Location:** `~/.openclaw/workspace/` (or per-agent workspace)

**SOUL.md Template Structure:**
```markdown
# Agent Name — Role

You are [Name]. A [tone] [role] who [core behavior].

## Core Truths
- Be genuinely helpful, not performatively helpful
- Build credibility through demonstrated competence
- Develop distinct viewpoints rather than deferring

## Boundaries
- Protect user privacy
- Acknowledge uncertainty when present
- No sycophancy or filler

## Vibe
Direct, substantive, authentic. Avoid corporate or obsequious patterns.

## Continuity
Sessions reset, but documentation serves as persistent memory.
Update this file as understanding develops.
```

**Runtime behavior:** These files are injected into the context window on every turn. Internal hooks (`agent:bootstrap`) can intercept to swap files dynamically.

---

### 3. Model Configuration with OpenRouter

**Basic setup:**
```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-..."
  },
  agents: {
    defaults: {
      model: {
        primary: "openrouter/anthropic/claude-sonnet-4-5",
        fallbacks: ["openrouter/openai/gpt-4o"]
      }
    }
  }
}
```

**Model reference format:** `openrouter/<provider>/<model>`

Examples:
- `openrouter/anthropic/claude-sonnet-4-5`
- `openrouter/openai/gpt-4o`
- `openrouter/auto` (auto-routing based on prompt complexity)

**Is `openrouter/auto` valid?** YES. After fix in GitHub issue #5395, `openrouter/auto` resolves correctly. This auto-routes to cost-effective models based on task complexity.

**Setup via CLI:**
```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter
```

---

### 4. Complete `openclaw.json` Schema (Relevant Sections)

```json5
{
  // Editor metadata
  $schema: "https://openclaw.ai/schema/config.json",

  // Environment variables (including API keys)
  env: {
    OPENROUTER_API_KEY: "sk-or-..."
  },

  // Global identity (fallback if not set per-agent)
  identity: {
    name: "AgentName",
    theme: "helpful assistant",
    emoji: "🤖",
    avatar: "avatars/agent.png"
  },

  // Agent configuration
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: {
        primary: "openrouter/anthropic/claude-sonnet-4-5",
        fallbacks: ["openrouter/openai/gpt-4o"]
      },
      models: {
        "openrouter/anthropic/claude-sonnet-4-5": { alias: "Sonnet" }
      },
      imageMaxDimensionPx: 1200,
      heartbeat: {
        every: "30m",
        target: "last"
      },
      sandbox: {
        mode: "non-main",
        scope: "agent"
      },
      userTimezone: "America/New_York",
      timeFormat: "12"  // "auto", "12", "24"
    },
    list: [
      {
        id: "main",
        default: true,
        workspace: "~/.openclaw/workspace",
        identity: {
          name: "MainAgent",
          theme: "space lobster",
          emoji: "🦞"
        },
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw"]
        }
      },
      {
        id: "work",
        workspace: "~/work-agent",
        identity: {
          name: "WorkBot",
          theme: "professional assistant",
          emoji: "💼"
        }
      }
    ]
  },

  // Channel routing to agents
  bindings: [
    // Routes specific channels to specific agents
  ],

  // Gateway settings
  gateway: {
    // Port, security, etc.
  },

  // Channels (WhatsApp, Telegram, Slack, etc.)
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"]
    }
  },

  // Other top-level keys
  session: {},
  cron: {},
  hooks: {},
  broadcast: {},
  ui: {},
  logging: {},
  tools: {},
  browser: {},
  skills: {},
  audio: {},
  talk: {},
  web: {},
  discovery: {},
  plugins: {},
  messages: {}
}
```

---

### 5. Profile Concept

OpenClaw implements "profiles" through the `agents.list[]` array. Each entry is effectively a separate agent profile with:

- **`id`** — Unique identifier (e.g., "main", "work", "personal")
- **`default`** — Boolean, which agent handles unrouted requests
- **`workspace`** — Separate file system for each profile
- **`identity`** — Per-profile name, theme, emoji, avatar
- **Model overrides** — Can be set per-agent

**Switching profiles:**
```bash
openclaw agent --agent work --message "Check my calendar"
```

**Routing via bindings:**
```json5
{
  bindings: [
    { channel: "slack", agent: "work" },
    { channel: "whatsapp", agent: "personal" }
  ]
}
```

---

### 6. OpenRouter Integration Summary

| Aspect | Configuration |
|--------|---------------|
| API Key | `env.OPENROUTER_API_KEY` |
| Model format | `openrouter/<provider>/<model>` |
| Auto-routing | `openrouter/auto` (valid) |
| Fallbacks | `agents.defaults.model.fallbacks[]` |
| Auth profiles | Supported for keychain storage |

---

## Conflicts & Uncertainties

1. **`identity.theme` injection** — Documentation mentions `theme` is "injected into system prompt" but exact mechanism unclear. May just be metadata or may augment SOUL.md content.

2. **Top-level vs per-agent identity** — Both `identity` (top-level) and `agents.list[].identity` exist. Likely resolution order is per-agent > defaults > global, but not explicitly documented.

3. **`openrouter/auto` vs `openrouter/openrouter/auto`** — Both appear to work after fix, but `openrouter/auto` is the canonical format.

---

## Onnex Implications

For deploying OpenClaw as an Onnex AI gateway:

1. **Agent persona goes in SOUL.md, not config** — Create workspace files for each client vertical (PI law, NDT, medical) rather than trying to configure prompts in JSON.

2. **Multi-tenant via agents.list** — Each client or vertical can be a separate agent entry with isolated workspace, identity, and model configuration.

3. **OpenRouter is the right choice** — Native integration, `openrouter/auto` for cost optimization, explicit model selection when needed.

4. **Docker deployment** — Image `ghcr.io/openclaw/openclaw:latest` runs on port 47823 (custom) or 18789 (default gateway port).

---

## Recommendations

1. **Create workspace structure** with SOUL.md, IDENTITY.md, and USER.md files for the PI Lawyer OS agent persona
2. **Use `openrouter/auto`** for cost-optimized general tasks, with explicit `openrouter/anthropic/claude-sonnet-4-5` for complex legal analysis
3. **Configure `agents.list[]`** with distinct agent IDs if deploying multiple personas (e.g., intake bot vs case analyst)
4. **Set `identity.name`** to the client-facing name (e.g., "Casey" for PI law firm assistant)

---

## Sources

| # | URL | Type | Verified | Used For |
|---|-----|------|----------|----------|
| 1 | [OpenClaw Configuration](https://docs.openclaw.ai/gateway/configuration) | Primary | Yes | Top-level schema structure |
| 2 | [OpenClaw AGENTS.md](https://github.com/openclaw/openclaw/blob/main/AGENTS.md) | Primary | Yes | Agent configuration details |
| 3 | [OpenClaw OpenRouter Provider](https://docs.openclaw.ai/providers/openrouter) | Primary | Yes | OpenRouter model format |
| 4 | [OpenClaw System Prompt Concepts](https://docs.openclaw.ai/concepts/system-prompt) | Primary | Yes | System prompt assembly |
| 5 | [MoltFounders Configuration Guide](https://moltfounders.com/openclaw-configuration) | Secondary | Yes | Identity object structure |
| 6 | [OpenClaw CLI Agents](https://docs.openclaw.ai/cli/agents) | Primary | Yes | set-identity command |
| 7 | [GitHub Issue #5395](https://github.com/openclaw/openclaw/issues/5395) | Primary | Yes | openrouter/auto validation |
| 8 | [SOUL.md Template](https://docs.openclaw.ai/reference/templates/SOUL) | Primary | Yes | SOUL.md structure |
| 9 | [OpenClaw GitHub README](https://github.com/openclaw/openclaw) | Primary | Yes | Installation, architecture |
| 10 | [OpenRouter Integration Guide](https://openrouter.ai/docs/guides/guides/openclaw-integration) | Primary | Yes | OpenRouter setup |
