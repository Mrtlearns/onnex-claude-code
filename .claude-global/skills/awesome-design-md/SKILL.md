# Skill: awesome-design-md (VoltAgent)

Design system markdown patterns and component documentation standards.
Repo: https://github.com/VoltAgent/awesome-design-md

---

## What It Does

A curated collection of markdown patterns for documenting UI components, design tokens,
and design systems in a way that's LLM-readable and version-controllable.

Enables Claude to generate consistent design documentation, component specs, and
design system audits aligned to the VoltAgent pattern standard.

---

## When to Apply

- TRIGGER: User asks to document a component, design system, or UI pattern
- TRIGGER: User asks to create a design spec or handoff document
- TRIGGER: User is building a frontend and wants design system documentation
- TRIGGER: User mentions "design tokens", "component library", "design handoff"

---

## Core Patterns

### Component Spec Template
```markdown
## ComponentName

**Purpose:** One-line description of what this component does.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| ...  | ...  | ...     | ...         |

### States
- Default
- Hover
- Active
- Disabled
- Error

### Usage
\`\`\`tsx
<ComponentName prop="value" />
\`\`\`

### Accessibility
- ARIA role: ...
- Keyboard: ...
- Screen reader: ...
```

### Design Token Format
```markdown
## Token: color/brand/primary
- **Value:** #1A73E8
- **Usage:** Primary CTAs, links, focus rings
- **Dark mode:** #4DA1F5
```

### Design System Audit Template
```markdown
## Design Audit: [System Name]
**Date:** YYYY-MM-DD
**Audited by:** Claude + Mr. T

### Coverage
- [ ] Color tokens
- [ ] Typography scale
- [ ] Spacing system
- [ ] Component inventory

### Findings
...
```

---

## Onnex Application

Apply when delivering frontend work to clients — component docs go in project's `docs/design/` folder.

---

## Status
READY — no configuration required (reference patterns only).
