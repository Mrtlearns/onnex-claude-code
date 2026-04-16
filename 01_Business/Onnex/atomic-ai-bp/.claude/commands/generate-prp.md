# Generate PRP

Generate a complete PRP (Product Requirements Prompt) for feature implementation with thorough research.

## Process

Read the feature request file first: `$ARGUMENTS`

Understand:
- What needs to be created
- How the examples provided help
- Any other considerations

The AI agent only gets the context appended to the PRP and its training data. Assume the agent has access to the codebase and the same knowledge cutoff, so your research findings must be included or referenced in the PRP. The agent has web search capabilities, so pass URLs to documentation and examples.

## Research Phase

1. **Read the feature request** from `$ARGUMENTS`
2. **Explore the codebase** - understand existing patterns, conventions, and structure
3. **Check the `examples/` folder** - identify patterns to follow
4. **Check `reference/`** - relevant docs, APIs, specs
5. **Search for relevant documentation** - include URLs in the PRP
6. **Identify gotchas** - known failure patterns, edge cases, quirks

## *** CRITICAL: BEFORE WRITING THE PRP ***
## *** ULTRATHINK ABOUT THE PRP AND PLAN YOUR APPROACH ***

## PRP Structure to Generate

Save the PRP to: `PRPs/[feature-name]-[YYYY-MM-DD].md`

```markdown
# PRP: [Feature Name]

## Overview
[What this feature does and why it's needed]

## Context & Background
[Relevant codebase patterns, existing code to reference]

## Implementation Blueprint

### Requirements
[Detailed functional requirements]

### Architecture
[How this fits into the existing structure]

### Step-by-Step Implementation
[Numbered steps with specific file paths and code patterns]

### Examples to Follow
[Reference specific files in examples/ with explanation of what to follow]

### Documentation & Resources
[URLs to relevant docs, APIs, libraries]

### Validation Gates
[Tests and checks that must pass - be specific with commands]

### Known Gotchas
[Common failure patterns and how to avoid them]

### Error Patterns & Recovery
[If validation fails, how to debug and fix]

## Success Criteria
[Specific, measurable outcomes that define done]

## Confidence Score: [1-10]
[Confidence this PRP provides enough context for one-pass implementation]
```

## Goal

The goal is **one-pass implementation success** through comprehensive context. Score the PRP 1-10 on confidence it will succeed without additional clarification.
