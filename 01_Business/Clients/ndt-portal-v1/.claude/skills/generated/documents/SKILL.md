---
name: documents
description: "Skill for the Documents area of ndt-portal-v1. 17 symbols across 3 files."
---

# Documents

17 symbols | 3 files | Cohesion: 95%

## When to Use

- Working with code in `frontend/`
- Understanding how NextcloudBrowser, navigateTo, toggleSelect work
- Modifying documents-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/documents/NextcloudBrowser.tsx` | parseWebDavXml, NextcloudBrowser, navigateTo, toggleSelect, handleItemClick (+3) |
| `frontend/src/components/documents/DocumentsApp.tsx` | encodePath, collectEntries, DocumentsApp, uploadFiles, uploadFolder (+2) |
| `frontend/src/components/documents/DocumentViewer.tsx` | getFileType, DocumentViewer |

## Entry Points

Start here when exploring this area:

- **`NextcloudBrowser`** (Function) — `frontend/src/components/documents/NextcloudBrowser.tsx:70`
- **`navigateTo`** (Function) — `frontend/src/components/documents/NextcloudBrowser.tsx:80`
- **`toggleSelect`** (Function) — `frontend/src/components/documents/NextcloudBrowser.tsx:106`
- **`handleItemClick`** (Function) — `frontend/src/components/documents/NextcloudBrowser.tsx:115`
- **`handleDeleteClick`** (Function) — `frontend/src/components/documents/NextcloudBrowser.tsx:129`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `NextcloudBrowser` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 70 |
| `navigateTo` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 80 |
| `toggleSelect` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 106 |
| `handleItemClick` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 115 |
| `handleDeleteClick` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 129 |
| `performDelete` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 138 |
| `exitSelectMode` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 149 |
| `DocumentsApp` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 40 |
| `uploadFiles` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 50 |
| `uploadFolder` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 76 |
| `handleDrop` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 114 |
| `createFolder` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 157 |
| `DocumentViewer` | Function | `frontend/src/components/documents/DocumentViewer.tsx` | 49 |
| `parseWebDavXml` | Function | `frontend/src/components/documents/NextcloudBrowser.tsx` | 31 |
| `encodePath` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 14 |
| `collectEntries` | Function | `frontend/src/components/documents/DocumentsApp.tsx` | 18 |
| `getFileType` | Function | `frontend/src/components/documents/DocumentViewer.tsx` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DocumentsApp → EncodePath` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 2 calls |

## How to Explore

1. `gitnexus_context({name: "NextcloudBrowser"})` — see callers and callees
2. `gitnexus_query({query: "documents"})` — find related execution flows
3. Read key files listed above for implementation details
