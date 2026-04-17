# A1 — Conversational Compliance Copilot (Per-Control Chat)

## Status: Planned | Priority: M (1 week) | Sprint: Next

---

## Problem Statement

Every control today shows a static block of text: the `requirement_text`, `assessment_objective`, and `acceptable_proof_guidance`. A compliance professional can parse that. A production manager at a 20-person machine shop cannot. They need to ask questions:

- "We're on Azure AD with Okta MFA. Do we satisfy this?"
- "What exactly does 'access enforcement' mean for a file server?"
- "Our policy says users can't share accounts. Is that enough, or do we need a log?"

Today there's no way to ask. The MSP has to manually answer each question. With a chat interface grounded in:

1. The NIST SP 800-171A assessment guide (authoritative C3PAO reference)
2. This specific org's uploaded artifacts and inventory
3. The control's full objective decomposition
4. Prior assessment verdicts and rationale

...the platform can answer accurately in seconds, cite its sources, and reduce MSP support burden by an order of magnitude.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client user | To ask what a control requires in plain English | I understand what I need to do |
| US-02 | Client user | To ask if my current setup satisfies a control | I know whether to upload evidence or remediate |
| US-03 | Client admin | To ask what evidence types C3PAO assessors typically accept | I upload the right thing the first time |
| US-04 | Client admin | To see which of my existing artifacts the copilot is citing | I trust the answer and can verify it |
| US-05 | MSP admin | To see the conversation history for a control | I can review what guidance was given to the client |
| US-06 | Client user | To ask follow-up questions in the same conversation | I don't repeat context each time |
| US-07 | MSP admin | To add a custom instruction that gets prepended for all orgs | I can enforce my MSP's specific methodology |

---

## Technical Design

### Data Model Changes

**New table: `control_chat_messages`**

```sql
CREATE TABLE control_chat_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content             TEXT NOT NULL,
    cited_artifact_ids  UUID[],         -- artifact IDs cited in this assistant turn
    cited_chunk_ids     UUID[],         -- artifact_chunks used for RAG context
    model_used          TEXT,
    tokens_used         INT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON control_chat_messages (program_control_id, created_at DESC);
```

**New table: `nist_guide_chunks`** (one-time ingestion of SP 800-171A)

```sql
CREATE TABLE nist_guide_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nist_id         TEXT NOT NULL,          -- e.g. '3.1.1'
    section         TEXT,                   -- e.g. 'Discussion', 'Assessment Methods'
    chunk_text      TEXT NOT NULL,
    chunk_index     INT NOT NULL,
    embedding       VECTOR(1536),
    UNIQUE (nist_id, chunk_index)
);

CREATE INDEX ON nist_guide_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### RAG Context Assembly

For each user message, the copilot assembles context from four sources:

```python
async def build_context(
    program_control_id: UUID,
    user_message: str,
    user_org_id: str,
    conn: asyncpg.Connection,
) -> str:
    # 1. Control definition + all objectives (already in DB)
    control = await conn.fetchrow(
        "SELECT cd.*, pc.status, pc.implementation_notes "
        "FROM program_controls pc JOIN control_definitions cd ... WHERE pc.id = $1",
        program_control_id
    )

    # 2. Org's artifacts for this control + their assessment rationale
    artifacts = await conn.fetch(
        "SELECT ar.file_name, a.verdict, a.rationale, a.gaps "
        "FROM artifacts ar JOIN assessments a ON ... "
        "WHERE ar.program_control_id = $1 ORDER BY a.created_at DESC LIMIT 5",
        program_control_id
    )

    # 3. Org's artifact chunks with high cosine similarity to the user's question
    query_vec = await embeddings_service.embed_one(user_message)
    similar_chunks = await conn.fetch(
        "SELECT ac.chunk_text, ar.file_name "
        "FROM artifact_chunks ac JOIN artifacts ar ON ac.artifact_id = ar.id "
        "JOIN program_controls pc ON ar.program_control_id = pc.id "
        "JOIN programs p ON pc.program_id = p.id "
        "WHERE p.org_id = $1 AND 1 - (ac.embedding <=> $2) > 0.6 "
        "ORDER BY ac.embedding <=> $2 LIMIT 8",
        user_org_id, str(query_vec)
    )

    # 4. NIST SP 800-171A guide chunks for this specific control
    nist_chunks = await conn.fetch(
        "SELECT chunk_text, section FROM nist_guide_chunks "
        "WHERE nist_id = $1 ORDER BY chunk_index",
        control['nist_id']
    )

    return _format_context(control, artifacts, similar_chunks, nist_chunks)
```

### System Prompt

```
You are a CMMC Level 2 compliance advisor for {org_name}, an organization pursuing 
NIST SP 800-171 compliance. You are assisting with control {nist_id}: {requirement_text}.

IMPORTANT RULES:
- Only make claims grounded in the provided context. Do not invent requirements.
- When citing an artifact, reference it by file name and artifact ID.
- When citing NIST guidance, prefix with "Per NIST SP 800-171A:".
- If you are unsure, say so and recommend the user consult their MSP advisor.
- Be concise but thorough. Use bullet points for lists of requirements.
- Never provide legal advice or guarantee C3PAO assessment outcomes.

CONTROL CONTEXT:
{control_definition_and_objectives}

ORG'S UPLOADED EVIDENCE:
{artifacts_and_assessments}

RELEVANT EVIDENCE EXCERPTS:
{similar_artifact_chunks}

NIST SP 800-171A GUIDANCE FOR THIS CONTROL:
{nist_guide_chunks}

CONVERSATION HISTORY:
{prior_messages}
```

### FastAPI Changes

**New endpoints in `app/routers/controls.py`:**

```
POST   /api/controls/program/{program_id}/{control_id}/chat    # send message, get response
GET    /api/controls/program/{program_id}/{control_id}/chat    # get conversation history
DELETE /api/controls/program/{program_id}/{control_id}/chat    # clear conversation
```

**Chat endpoint (streaming):**
```python
@router.post("/{program_control_id}/chat")
async def chat(
    program_control_id: str,
    body: ChatMessage,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> StreamingResponse:
    context = await build_context(program_control_id, body.message, user["org_id"], conn)
    history = await get_chat_history(program_control_id, conn, limit=10)

    async def _stream():
        full_response = ""
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", settings.openrouter_url, ...) as resp:
                async for chunk in resp.aiter_text():
                    full_response += chunk
                    yield f"data: {chunk}\n\n"

        # Save to DB after streaming completes
        await save_messages(program_control_id, user["user_id"], body.message, full_response, conn)

    return StreamingResponse(_stream(), media_type="text/event-stream")
```

Model: `anthropic/claude-sonnet-4-6` via OpenRouter (same API, just different model string). Streaming = real-time response, better UX for longer answers.

### Frontend Changes

**Control detail page (`/[orgSlug]/controls/[id]/page.tsx`):**
- New "Copilot" tab alongside existing "Artifacts" and "Assessments" tabs
- Chat UI: message list (scrollable), input bar with send button, streaming text display
- Source citations panel: when assistant cites an artifact, show its file name as a clickable chip that opens the artifact preview
- "Clear conversation" button
- Typing indicator while streaming
- Conversation persists per (user, control) — shows history on return

**Component:** `CopilotChat.tsx` — reusable component that can be embedded in any page

---

## One-Time Setup: NIST SP 800-171A Ingestion

**Script: `scripts/ingest_nist_guide.py`**

```python
"""
One-time ingestion of NIST SP 800-171A Assessment Guide.
Source: NIST PDF or structured JSON (preferred).
Chunks by control section, embeds, stores in nist_guide_chunks.
"""
```

Source: The NIST SP 800-171A document is public domain — parse the PDF or use a pre-chunked version. ~800 sections, ~5–10 chunks per control = ~1,100 total chunks. Embedding cost: ~$0.04 (negligible).

---

## Implementation Phases

**Phase 1 (Days 1-2):** DB migration. NIST SP 800-171A ingestion script. `build_context()` function. Chat endpoint (non-streaming first).

**Phase 2 (Day 3):** Streaming response. Save to `control_chat_messages`. History endpoint.

**Phase 3 (Day 4-5):** Frontend `CopilotChat.tsx` component. Citation chips. Integration into control detail page. Manual testing with 5 canonical questions per control family.

---

## Acceptance Criteria

- [ ] NIST SP 800-171A ingested with all 110 control sections chunked and embedded
- [ ] Chat endpoint returns grounded answers within 10s (non-streaming) or begins streaming within 2s
- [ ] Artifact citations are accurate (cited file name matches artifact in DB)
- [ ] NIST citations are prefixed with "Per NIST SP 800-171A:"
- [ ] Conversation history persists across browser sessions for (user, control)
- [ ] "Clear conversation" resets history for that user/control pair only
- [ ] 403 if user attempts to chat on a control from a different org
- [ ] Streaming works in Chrome, Firefox, Safari
- [ ] MSP custom instruction is prepended to system prompt when configured
- [ ] Token usage logged in `control_chat_messages.tokens_used`
- [ ] All existing pytest tests still pass
