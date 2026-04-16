---
name: msg
description: "Skill for the Msg area of ndt-portal-v1. 13 symbols across 3 files."
---

# Msg

13 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `frontend/`
- Understanding how AttachmentPreview, handleFile, attemptUpload work
- Modifying msg-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/msg/AttachmentPreview.tsx` | fileExt, mimeFor, isImage, isPdf, canPreview (+1) |
| `frontend/src/components/msg/MsgUploader.tsx` | handleFile, attemptUpload, onDrop, onInputChange |
| `frontend/src/components/msg/CompliancePanel.tsx` | CompliancePanel, poll, stopPolling |

## Entry Points

Start here when exploring this area:

- **`AttachmentPreview`** (Function) — `frontend/src/components/msg/AttachmentPreview.tsx:43`
- **`handleFile`** (Function) — `frontend/src/components/msg/MsgUploader.tsx:49`
- **`attemptUpload`** (Function) — `frontend/src/components/msg/MsgUploader.tsx:62`
- **`onDrop`** (Function) — `frontend/src/components/msg/MsgUploader.tsx:98`
- **`onInputChange`** (Function) — `frontend/src/components/msg/MsgUploader.tsx:106`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AttachmentPreview` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 43 |
| `handleFile` | Function | `frontend/src/components/msg/MsgUploader.tsx` | 49 |
| `attemptUpload` | Function | `frontend/src/components/msg/MsgUploader.tsx` | 62 |
| `onDrop` | Function | `frontend/src/components/msg/MsgUploader.tsx` | 98 |
| `onInputChange` | Function | `frontend/src/components/msg/MsgUploader.tsx` | 106 |
| `CompliancePanel` | Function | `frontend/src/components/msg/CompliancePanel.tsx` | 131 |
| `poll` | Function | `frontend/src/components/msg/CompliancePanel.tsx` | 144 |
| `stopPolling` | Function | `frontend/src/components/msg/CompliancePanel.tsx` | 163 |
| `fileExt` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 18 |
| `mimeFor` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 22 |
| `isImage` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 26 |
| `isPdf` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 30 |
| `canPreview` | Function | `frontend/src/components/msg/AttachmentPreview.tsx` | 34 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AttachmentPreview → FileExt` | intra_community | 4 |
| `CompliancePanel → StopPolling` | intra_community | 3 |
| `OnDrop → AttemptUpload` | intra_community | 3 |
| `OnInputChange → AttemptUpload` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "AttachmentPreview"})` — see callers and callees
2. `gitnexus_query({query: "msg"})` — find related execution flows
3. Read key files listed above for implementation details
