# Onnex Core Refactoring Skill

Apply these standards whenever splitting, extracting, or reorganising code across any Onnex project. Covers React/TypeScript frontends and Node.js/TypeScript backends.

---

## When to Split

Split a file when ANY of the following are true:

1. **Threshold exceeded** — file is over the size limit for its type (see below)
2. **"And" test fails** — you cannot describe the file's purpose in one sentence without the word "and"
3. **Single prop group** — a section of JSX only depends on one prop object; extract that section
4. **Rule of three** — the same logic pattern appears 3+ times
5. **Unrelated re-renders** — state changes in one area cause re-renders in unrelated sections
6. **Hard to unit test** — logic is buried in a large component and cannot be tested without rendering the whole page; extract to a pure function or hook
7. **Low test coverage** — a module has poor coverage because it mixes concerns; splitting enables targeted tests
8. **Merge conflict magnet** — multiple engineers regularly conflict on the same file

**Do NOT split** for its own sake. The file must have a real problem.

---

## Size Thresholds

| File type | Split at | Target per resulting file |
|-----------|----------|--------------------------|
| React component (`.tsx`) | **300 lines** | ≤ 250 lines |
| React hook (`use*.ts`) | **150 lines** | ≤ 120 lines |
| Node.js service / module (`.ts`) | **400 lines** | ≤ 300 lines |

---

## React/TSX — Orchestrator Pattern

```
ParentComponent.tsx        ← state, hooks, layout, composes children
├── ChildA.tsx             ← presentational, typed props, exported type
├── ChildB.tsx             ← presentational, typed props, exported type
└── useParentLogic.ts      ← extracted hook if logic is >50 lines
```

**Rules:**
- Orchestrator re-exports anything consumers previously imported from the original file
- Each child receives only the props it needs — no overpassing
- Props interface defined **and** exported in the same file as the component
- No prop drilling deeper than 2 levels — lift to a hook or context instead
- API calls belong in custom hooks, never directly in components

**TypeScript after a split:**
- Types stay with their component — NOT in a central `types/` folder
- Re-export types from orchestrator: `export type { ChildProps } from './Child'`
- Use `Pick<>` / `Omit<>` to derive child props from parent — don't duplicate
- Never use `any` to paper over type errors created during the split

---

## Node.js/TypeScript — Service Pattern

```
ServiceName.service.ts     ← main class, orchestrates
├── serviceName.utils.ts   ← pure helper functions
├── serviceName.types.ts   ← types if shared across >1 file
└── __tests__/             ← co-located unit tests
```

**Rules:**
- Each service handles one responsibility
- Errors propagate — no silent swallowing in catch blocks
- Pure helper functions extracted to `.utils.ts` are immediately unit-testable

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| React component files | PascalCase | `QuoteDetailPanel.tsx` |
| React hook files | camelCase, `use` prefix | `useQuoteFilter.ts` |
| Utility files | camelCase | `quoteUtils.ts` |
| Type files (when needed) | PascalCase | `QuoteTypes.ts` |
| Test directories | `__tests__/` | co-located next to the file |
| Test files | match source name | `calculations.test.ts` |

---

## Unit Testing

### Framework Selection

| Project type | Framework | Reason |
|---|---|---|
| Vite + React/TS | **Vitest** | Shares Vite config and path aliases; 10–20× faster than Jest |
| Node.js / Express API | **Vitest** (preferred) or Jest | Vitest preferred for consistency across projects |
| Next.js | **Jest** | Next.js has first-class Jest integration |

### Setup — Vite Projects

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Create `vitest.config.ts` at project root:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

Add to `tsconfig.app.json` `compilerOptions`:
```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

### What to Test (priority order)

1. **Pure calculation functions** — zero mocking, immediate value, high ROI
2. **Utility/helper functions** — scheduling, formatting, validation logic
3. **Custom hooks** — use `renderHook` from React Testing Library
4. **API wrappers** — only if mocking is simple (`vi.mock`)

### What NOT to Test

- React UI components — Playwright E2E covers this adequately
- 3D/WebGL/canvas components — cannot run in jsdom
- API wrappers with complex network mocking — low ROI

### "API Calls Only in Hooks" Rule

Components that call `fetch()` directly cannot be unit tested without DOM mocking. Extract API calls into a custom hook — the hook becomes mockable, the component becomes testable.

### Custom Hook Extraction Priority

Prefer extracting to a custom hook (over a plain utility function) when logic involves React state, effects, or refs. Hooks are testable with `renderHook`. This is the highest-value refactoring move when unit testing is active.

### Test File Location

Mirror the source directory structure and co-locate tests:
```
src/lib/rt/__tests__/calculations.test.ts
src/hooks/__tests__/useFolderReferences.test.ts
```

---

## TDD Gate — Mandatory During Refactoring

When extracting a pure function or custom hook:

1. **Write the test first** — against the function in its current location → it passes (GREEN)
2. **Move the function** to the new file → update the import in the test
3. **Run the test again** → still passes (proves the extraction was safe)

This gate is **not optional**. It is the primary proof that the split did not change behaviour.

---

## Verification Gates

Run in this order after every split. All must pass before the refactor is done.

1. `npx tsc --noEmit` → 0 errors
2. `npm run lint` → 0 new errors
3. `npm run build` → clean build
4. `npm test` → all unit tests pass *(mandatory if any functions or hooks were extracted)*
5. **Browser smoke test** → each affected page loads, no console errors
6. `gitnexus_detect_changes()` → confirms only expected files changed *(if GitNexus is available)*

---

## Impact Analysis (GitNexus Projects)

Before modifying any symbol in a GitNexus-indexed project:

```
gitnexus_impact({ target: "SymbolName", direction: "upstream" })
```

- **d=1 callers** — WILL BREAK — must update these
- **d=2** — LIKELY AFFECTED — test these
- **d=3** — MAY NEED TESTING — check if on critical path

Never proceed past a HIGH or CRITICAL risk warning without informing Mr. T.

---

## Common Mistakes to Avoid

- Splitting a file that doesn't have a clear problem (premature abstraction)
- Creating a helper or utility for a one-time use
- Using `any` to paper over type errors created by the split
- Leaving dead imports or unused exports in any file after the split
- Mixing refactoring commits with feature or bug-fix commits
- Re-exporting everything from an `index.ts` barrel file — prefer direct imports
