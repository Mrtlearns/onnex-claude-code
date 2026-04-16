# Skill: Skill Creator (Anthropic)

Official Anthropic guide for building Claude Code skills.
Repo: https://github.com/anthropics/skills-guide

---

## What It Does

Teaches the canonical pattern for creating skills that load into Claude Code sessions.
Every skill in `skills/` was built using this pattern (or should be validated against it).

---

## When to Apply

- TRIGGER: User asks to create a new skill
- TRIGGER: User asks to improve or restructure an existing SKILL.md
- TRIGGER: User wants to add a new tool/workflow to the global skill set
- TRIGGER: "build a skill", "make a skill for", "add skill"

---

## Skill File Structure (Canonical)

```
skills/<skill-name>/
└── SKILL.md          ← required: the skill itself
    CHECKLIST.md      ← optional: verification checklist
    scripts/          ← optional: supporting scripts
```

---

## SKILL.md Template

```markdown
# Skill: <Name>

<One-paragraph description of what this skill does and when it applies.>

---

## When to Apply

- TRIGGER: <specific trigger condition 1>
- TRIGGER: <specific trigger condition 2>

---

## <Section: Core Operations / Standards / Patterns>

<Content relevant to the skill domain.>

---

## Status
READY / NEEDS CONFIGURATION — <notes>
```

---

## Key Principles (from Anthropic guide)

1. **Specific triggers** — skills must define when they activate; vague skills get ignored
2. **Actionable content** — show commands, code, patterns; not just descriptions
3. **Scoped** — one skill, one domain; don't build monolithic skills
4. **Register in CLAUDE.md** — global skills must be listed in the skills table to be discovered
5. **Test with `/prime`** — after creating, run `/prime` in the project to verify loading

---

## Creating a New Skill (Workflow)

```
1. Define trigger conditions
2. Write SKILL.md using template above
3. Save to D:\Code\Claude\.claude-global\skills\<name>\SKILL.md
4. Add entry to CLAUDE.md Global Skills table
5. Test: open new session, trigger the skill, verify behavior
```

---

## Status
READY — no configuration required (reference workflow only).
