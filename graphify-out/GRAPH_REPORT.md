# Graph Report - onnex-claude-code  (2026-05-23)

## Corpus Check
- 117 files · ~52,979 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 822 nodes · 1329 edges · 59 communities (56 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a346cc4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 81|Community 81]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 84 edges
2. `useOS()` - 21 edges
3. `compilerOptions` - 19 edges
4. `compilerOptions` - 14 edges
5. `Toast` - 14 edges
6. `useToast()` - 14 edges
7. `readKey()` - 12 edges
8. `CLAUDE.md — Pickup brief for Claude Code` - 10 edges
9. `On-Nex Training Portal` - 10 edges
10. `Supabase backend build spec — On-Nex Training Portal` - 10 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  src/lib/utils.ts → package.json
- `On-Nex Training Portal — Pickup brief for Claude Code` --references--> `On-Nex Training Portal — Documentation for Claude Code workshop`  [EXTRACTED]
  CLAUDE.md → docs/README.md
- `On-Nex Training Portal — Pickup brief for Claude Code` --references--> `Supabase backend build spec for On-Nex Training Portal`  [EXTRACTED]
  CLAUDE.md → docs/SUPABASE_SCHEMA.md
- `On-Nex Training Portal — Pickup brief for Claude Code` --references--> `Test plan for On-Nex Training Portal`  [EXTRACTED]
  CLAUDE.md → docs/TEST_PLAN.md
- `On-Nex Training Portal — Pickup brief for Claude Code` --references--> `Docker Compose configuration for onnex-claude-code`  [EXTRACTED]
  CLAUDE.md → docker-compose.yml

## Communities (59 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (20): ActivityLog(), BulkEditor(), BulkMode, EditorMode, LessonList(), PublishAllButton(), relativeTime(), SaveStatus() (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (16): async(), AssetListener, assetListeners, AssetMeta, deleteAsset(), getDB(), getImage(), newId() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.19
Nodes (13): AdminEditor(), onImport(), discardAllDrafts(), importPublished(), LessonOverride, Listener, listeners, notify() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (44): CookieBanner(), LessonPage(), options, OSPicker(), items, OSToggle(), enterAdmin(), exitAdmin() (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (36): PreviewCard(), Props, refresh(), SnapshotPreview(), VersionHistoryDialog(), useResolvedMarkdown(), clearHistory(), getHistory() (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (16): handleFiles(), insertAtCursor(), insertCodeBlock(), insertLink(), linePrefix(), MarkdownEditor, MarkdownEditorHandle, onDrop() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (52): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers, input-otp (+44 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (14): ActivityEntry, ActivityScope, clearActivity(), getActivity(), Listener, listeners, logActivity(), newId() (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (11): getPublished(), bodyFor(), LessonBody, LessonKind, lessons, bodyTextSample(), collectFromBody(), computeAssetUsage() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (8): On-Nex Training Portal — Pickup brief for Claude Code, Docker Compose configuration for onnex-claude-code, On-Nex Training Portal — Documentation for Claude Code workshop, Supabase backend build spec for On-Nex Training Portal, Test plan for On-Nex Training Portal, HTML index file for onnex-claude-code, Robots.txt file for onnex-claude-code public directory, README file for onnex-claude-code

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (16): cn(), ButtonProps, buttonVariants, Calendar(), CalendarProps, Pagination(), PaginationContent, PaginationEllipsis() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (35): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, fake-indexeddb, globals (+27 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (11): ActivityRow(), relTime(), timeStr(), AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (37): useIsMobile(), Input, Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader() (+29 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (28): 1. Goals, 2. Roles, 3.1 `profiles`, 3.2 `lessons` (default catalogue), 3.3 `lesson_published`, 3.4 `lesson_drafts`, 3.5 `lesson_snapshots`, 3.6 `activity_log` (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (3): Doc, DOCS, DocsPage()

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (8): ICONS, LessonCard(), LessonIndex(), osCoverage(), useLesson(), useLessons(), Lesson, LessonIcon

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (13): Button, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (11): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (15): Architecture, code:text (┌──────────────────────────────────────────┐), code:text (src/content/lessons.ts  (default)), code:bash (bun install          # install deps), Directory map, `/docs` route, Elevator pitch, Feature inventory (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.23
Nodes (13): applyToDrafts(), buildBody(), handlePublish(), handleRestoreSnapshot(), handleSaveDraftNow(), publishStaged(), onDeleteSelected(), onDeleteUnused() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (11): CLAUDE.md — Pickup brief for Claude Code, code:bash (bun install), Conventions (don't break these), Don't do, graphify, Roadmap, Tech stack (pinned, do not swap), Testing (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, noImplicitAny, noUnusedLocals, noUnusedParameters, paths, skipLibCheck, strictNullChecks (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): 1. Fix the racing OS-swap test, 2. Documentation refresh (small, surgical), 3. Verification, code:ts (import { waitForElementToBeRemoved } from "@testing-library/), Files touched, Finish the per-OS / theme / docs loop

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): Automated, code:bash (bunx vitest run), Manual smoke checklist, Test Plan — On-Nex Training Portal, When something fails

### Community 31 - "Community 31"
Cohesion: 0.10
Nodes (12): NavLink, NavLinkCompatProps, Avatar, AvatarFallback, AvatarImage, Checkbox, HoverCardContent, Progress (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 59 - "Community 59"
Cohesion: 0.17
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 61 - "Community 61"
Cohesion: 0.21
Nodes (9): AssetManager(), AssetRow(), Filter, fmtBytes(), fmtDate(), refresh(), subscribe(), listAssets() (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 72 - "Community 72"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 75 - "Community 75"
Cohesion: 0.12
Nodes (21): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+13 more)

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 81 - "Community 81"
Cohesion: 0.25
Nodes (10): handleDiscard(), logPublishAll(), onExport(), discardDraft(), exportPublished(), getDraftLessonsSnapshot(), getDrafts(), readKey() (+2 more)

## Knowledge Gaps
- **416 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+411 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 10` to `Community 0`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 20`, `Community 21`, `Community 22`, `Community 31`, `Community 40`, `Community 42`, `Community 45`, `Community 46`, `Community 48`, `Community 52`, `Community 54`, `Community 56`, `Community 59`, `Community 60`, `Community 61`, `Community 63`, `Community 66`, `Community 72`, `Community 75`, `Community 76`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 6` to `Community 11`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `clsx` connect `Community 6` to `Community 10`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `useOS()` (e.g. with `Admin()` and `Index()`) actually correct?**
  _`useOS()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _416 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0855614973262032 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.056049213943950786 - nodes in this community are weakly interconnected._