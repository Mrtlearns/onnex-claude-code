---
name: settings
description: "Skill for the Settings area of ndt-portal-v1. 29 symbols across 4 files."
---

# Settings

29 symbols | 4 files | Cohesion: 100%

## When to Use

- Working with code in `frontend/`
- Understanding how InspectionTypesTab, deleteType, deleteStep work
- Modifying settings-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/settings/RtMachineProfilesTab.tsx` | specToFields, fieldsToSpec, num, MachineForm, setField (+6) |
| `frontend/src/components/settings/InspectionTypesTab.tsx` | InspectionTypesTab, deleteType, deleteStep, onDragStart, onDragOver (+4) |
| `frontend/src/components/settings/SettingsApp.tsx` | loadSettings, SettingsApp, saveProvider, testProvider, save |
| `frontend/src/components/settings/DashboardsSettingsTab.tsx` | loadDashboardSettings, DashboardsSettingsTab, saveDashboardSettings, handleSave |

## Entry Points

Start here when exploring this area:

- **`InspectionTypesTab`** (Function) — `frontend/src/components/settings/InspectionTypesTab.tsx:321`
- **`deleteType`** (Function) — `frontend/src/components/settings/InspectionTypesTab.tsx:394`
- **`deleteStep`** (Function) — `frontend/src/components/settings/InspectionTypesTab.tsx:441`
- **`onDragStart`** (Function) — `frontend/src/components/settings/InspectionTypesTab.tsx:448`
- **`onDragOver`** (Function) — `frontend/src/components/settings/InspectionTypesTab.tsx:453`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InspectionTypesTab` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 321 |
| `deleteType` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 394 |
| `deleteStep` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 441 |
| `onDragStart` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 448 |
| `onDragOver` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 453 |
| `onDrop` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 463 |
| `typeFormInitial` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 493 |
| `stepFormInitial` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 498 |
| `stepPreview` | Function | `frontend/src/components/settings/InspectionTypesTab.tsx` | 514 |
| `SettingsApp` | Function | `frontend/src/components/settings/SettingsApp.tsx` | 149 |
| `saveProvider` | Function | `frontend/src/components/settings/SettingsApp.tsx` | 193 |
| `testProvider` | Function | `frontend/src/components/settings/SettingsApp.tsx` | 213 |
| `save` | Function | `frontend/src/components/settings/SettingsApp.tsx` | 238 |
| `RtMachineProfilesTab` | Function | `frontend/src/components/settings/RtMachineProfilesTab.tsx` | 711 |
| `handleCopyRequest` | Function | `frontend/src/components/settings/RtMachineProfilesTab.tsx` | 749 |
| `handleDelete` | Function | `frontend/src/components/settings/RtMachineProfilesTab.tsx` | 788 |
| `getFormInitial` | Function | `frontend/src/components/settings/RtMachineProfilesTab.tsx` | 803 |
| `DashboardsSettingsTab` | Function | `frontend/src/components/settings/DashboardsSettingsTab.tsx` | 30 |
| `handleSave` | Function | `frontend/src/components/settings/DashboardsSettingsTab.tsx` | 36 |
| `specToFields` | Function | `frontend/src/components/settings/RtMachineProfilesTab.tsx` | 221 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `MachineForm → Num` | intra_community | 4 |
| `SettingsApp → LoadSettings` | intra_community | 3 |
| `MachineForm → SpecToFields` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "InspectionTypesTab"})` — see callers and callees
2. `gitnexus_query({query: "settings"})` — find related execution flows
3. Read key files listed above for implementation details
