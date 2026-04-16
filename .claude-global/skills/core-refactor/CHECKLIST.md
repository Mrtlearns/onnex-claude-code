# Refactor Verification Checklist

Copy this checklist at the start of any refactoring task. Check each item before declaring the refactor done.

---

## Pre-Split

- [ ] Read the full file before touching it
- [ ] Run `gitnexus_impact` on all symbols being moved *(if GitNexus available)*
- [ ] List all files that import from this file — those consumers must not break
- [ ] **If extracting a pure function or hook: write the Vitest test FIRST** *(TDD gate — mandatory)*

---

## During Split

- [ ] Each new file has one clearly-stated purpose — one sentence, no "and"
- [ ] Props interface defined and exported from the same file as the component
- [ ] Orchestrator re-exports anything previously imported from the original file
- [ ] No prop drilling deeper than 2 levels in resulting components
- [ ] No `fetch()` calls directly in components — API calls moved to hooks

---

## Post-Split

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 new errors
- [ ] `npm run build` → clean
- [ ] `npm test` → all unit tests pass *(mandatory if functions or hooks were extracted)*
- [ ] Browser smoke test → each affected page loads, no console errors
- [ ] `gitnexus_detect_changes()` → only expected files changed *(if GitNexus available)*

---

## Never

- [ ] Split for its own sake — file must exceed threshold OR have a clear problem
- [ ] Create a helper or utility for a one-time-use function
- [ ] Use `any` to paper over type errors created during the split
- [ ] Leave dead imports or unused exports in any file
- [ ] Mix refactoring commits with feature or bug-fix commits
