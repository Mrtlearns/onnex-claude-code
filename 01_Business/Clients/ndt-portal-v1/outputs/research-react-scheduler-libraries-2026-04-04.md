# Research: React Resource Lane Scheduler Libraries

**Date:** 2026-04-04 | **Mode:** Standard | **Vertical:** NDT/Aerospace  
**Primary Question:** Which lightweight React library best supports a vertical-time, horizontal-resource lane scheduler?  
**Decision It Informs:** Whether to adopt a library vs. continue custom implementation for ndtv1 workshop scheduler

---

## Key Findings

1. **No library matches your exact layout (vertical time, horizontal resource lanes) out of the box.** Most timeline libraries are horizontal-time-first. You will need custom CSS/layout work regardless. Confidence: High

2. **react-calendar-timeline is the lightest viable option** (~35KB gzip with dayjs) and is MIT-licensed, TypeScript-native, has drag-drop built in. However, its layout is horizontal-time, vertical-resources (opposite of your spec). Confidence: High

3. **Planby is timeline-first and lightweight (~45KB)** with virtualization, but drag-drop/resize is PRO-only ($400/dev one-time). Custom license, not MIT. Confidence: High

4. **FullCalendar resource-timeline is the most feature-complete** but heaviest (~207KB total) and requires premium license ($480+/year for resource views). Confidence: High

5. **Schedule-X resource scheduler is premium-only** (no free tier for resource views). Not viable without license. Confidence: High

6. **react-big-calendar does NOT support vertical resource columns** - it's a traditional calendar, not a lane scheduler. Confidence: High

---

## Library Comparison Matrix

| Library | Bundle (gzip) | Layout Match | D&D Built-in | TS Native | License | npm/wk | Maintenance |
|---------|---------------|--------------|--------------|-----------|---------|--------|-------------|
| **react-calendar-timeline** | ~35KB | Horizontal time / vertical rows (INVERTED) | Yes | Yes (v0.30) | MIT | ~50K | Active (beta) |
| **planby** | ~45KB | Horizontal time / vertical rows (INVERTED) | PRO only | Yes | Custom/Proprietary | ~3K | Active |
| **@daypilot/daypilot-lite-react** | ~60KB est. | Configurable (can flip) | Yes | Partial | Apache 2.0 | ~8K | Active |
| **@fullcalendar/resource-timeline** | ~207KB total | Horizontal time / vertical resources | Yes | Yes | Premium ($480+/yr) | ~25K | Active |
| **@schedule-x/react** | ~40KB | Premium only for resources | Yes | Yes | Premium ($TBD) | ~5K | Active |
| **react-big-calendar** | ~65KB | NO resource lanes - traditional calendar | Yes | Via @types | MIT | ~755K | Stale (10mo) |

---

## Detailed Analysis

### react-calendar-timeline

**What it provides:**
- Horizontal time axis, vertical resource rows (groups)
- Drag-drop and resize built-in
- Full TypeScript rewrite in v0.30.0 beta
- dayjs replaced moment.js (massive size reduction)
- Virtualization not built-in but scrolls well

**What you still need custom:**
- **Layout flip** - Your spec wants vertical time, horizontal lanes. This library is the opposite.
- CSS transforms/rotation would be hacky and break DnD
- Better to adapt your UI spec to horizontal time if using this

**Verdict:** Best MIT option IF you can accept horizontal time layout. If vertical time is non-negotiable, skip.

---

### planby

**What it provides:**
- EPG/timeline-first design (horizontal time)
- Virtualization for 10K+ events (60fps)
- Custom JSX rendering for events
- Built-in TypeScript

**What you still need custom:**
- Drag-drop, resize → PRO only ($400/dev)
- Layout is horizontal time - same limitation as react-calendar-timeline

**Verdict:** Great architecture but paywalled features. Only consider if budget allows PRO.

---

### DayPilot Lite (daypilot-lite-react)

**What it provides:**
- **Configurable axis orientation** - can display resources as columns, time as rows
- Drag-drop event creation, resize
- Apache 2.0 license (commercial-friendly)
- Progressive rendering for large datasets

**What you still need custom:**
- Styling to match your design system
- Possibly SSE integration layer

**Verdict:** Best layout match potential. Apache licensed. Worth deeper evaluation.

---

### FullCalendar resource-timeline

**What it provides:**
- Most mature resource timeline implementation
- Extensive API, plugins, ecosystem
- Built-in drag-drop, resize, event overlap handling

**What you still need custom:**
- Layout is horizontal time (same limitation)
- Significant styling overrides for custom look

**Deal-breakers:**
- Premium license required ($480+ for resource-timeline)
- Annual renewal encouraged (50% discount if on time)
- Heaviest bundle (~207KB with dependencies)

**Verdict:** Skip. Too heavy, too expensive for what it provides over lighter alternatives.

---

### Schedule-X

**What it provides:**
- Modern TypeScript-first architecture
- Clean API, good DX

**Deal-breakers:**
- Resource scheduler is PREMIUM ONLY - no free tier
- Cannot evaluate without license purchase

**Verdict:** Skip. Premium-only for the feature you need.

---

### react-big-calendar

**What it provides:**
- Traditional month/week/day/agenda calendar views
- High npm downloads (755K/wk)

**Deal-breakers:**
- **Does NOT support resource lane layout** - GitHub issues requesting this remain open
- Designed for Outlook/Google Calendar style, not lane scheduling

**Verdict:** Skip. Wrong paradigm entirely.

---

## NDT Portal Implications

Your current spec describes:
- Vertical time ruler on left
- Horizontal resource lanes (RT, UT, ET, MT, PT, VT columns)
- Job cards positioned vertically by time

**Reality check:** Almost every React timeline library assumes horizontal time. The "inverted" layout you want is uncommon.

**Options:**

1. **Adapt UI spec to horizontal time** (recommended)
   - Use react-calendar-timeline or DayPilot
   - Inspection types become rows, time scrolls horizontally
   - This is the standard Gantt/scheduler pattern users expect
   - Eliminates need for custom layout math

2. **Use DayPilot with axis flip**
   - DayPilot explicitly supports vertical timeline with horizontal resource columns
   - Apache 2.0 license
   - Test this first if vertical time is non-negotiable

3. **Stay custom**
   - Keep @dnd-kit, write your own positioning math
   - Full control, but more code to maintain
   - May be faster if existing code is 70%+ complete

---

## Recommendations

### If horizontal time is acceptable:
```
react-calendar-timeline (MIT, ~35KB, TS-native)
```
- Swap your axis orientation in UI
- Leverage built-in DnD, resize, TypeScript
- v0.30 beta is stable enough for production

### If vertical time is non-negotiable:
```
@daypilot/daypilot-lite-react (Apache 2.0, ~60KB)
```
- Only library found that explicitly supports vertical time + horizontal resource columns
- Test axis configuration before committing

### If budget allows:
```
planby PRO ($400/dev one-time)
```
- Best virtualization, smoothest performance
- Still horizontal time, but best DX

### If staying custom:
- Keep @dnd-kit for drag-drop
- Build thin abstraction over pixel math
- Consider extracting positioning logic to a hook
- Re-evaluate in 6 months if maintenance burden grows

---

## Sources

| # | Title | Type | Used For |
|---|-------|------|----------|
| 1 | [react-calendar-timeline GitHub](https://github.com/namespace-ee/react-calendar-timeline) | Primary | Layout, TS support, DnD capabilities |
| 2 | [Planby Official](https://planby.app/) | Primary | Bundle size, features, pricing |
| 3 | [Planby npm](https://www.npmjs.com/package/planby) | Primary | License, downloads |
| 4 | [FullCalendar Pricing](https://fullcalendar.io/pricing) | Primary | License costs |
| 5 | [FullCalendar resource-timeline npm](https://www.npmjs.com/package/@fullcalendar/resource-timeline) | Primary | Bundle size |
| 6 | [Schedule-X Resource Scheduler](https://schedule-x.dev/docs/calendar/resource-scheduler) | Primary | Premium status |
| 7 | [DayPilot Open Source](https://code.daypilot.org/79813/react-scheduler-with-horizontal-timeline-open-source) | Primary | License, features |
| 8 | [react-big-calendar GitHub Issues](https://github.com/jquense/react-big-calendar/issues/2194) | Primary | Vertical resource view status |
| 9 | [DayPilot Vertical Timeline](https://code.daypilot.org/30952/react-scheduler-with-a-vertical-timeline) | Primary | Axis flip capability |
| 10 | [DHTMLX Best React Schedulers](https://dhtmlx.com/blog/best-react-scheduler-components-dhtmlx-bryntum-syncfusion-daypilot-fullcalendar/) | Secondary | Comparison context |
