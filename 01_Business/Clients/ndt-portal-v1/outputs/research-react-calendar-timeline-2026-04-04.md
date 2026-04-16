# Research: react-calendar-timeline for NDT Workshop Scheduler

**Date:** 2026-04-04 | **Mode:** Extensive | **Vertical:** NDT/Aerospace  
**Primary Question:** Can react-calendar-timeline support all NDT workshop scheduler requirements?  
**Decision It Informs:** Library selection for workshop scheduling UI component

---

## Executive Summary

**VERDICT: CONDITIONALLY SUITABLE** — react-calendar-timeline can meet 8 of 10 requirements natively or with minor customization. Two requirements (business hours hiding, side-by-side overlapping items) require significant custom implementation or may not be fully achievable.

---

## Key Findings

| # | Requirement | Support | Confidence |
|---|-------------|---------|------------|
| 1 | Multiple groups/lanes | **NATIVE** | High |
| 2 | Custom item rendering | **NATIVE** | High |
| 3 | Drag-and-drop (time + group) | **NATIVE** | High |
| 4 | Day navigation (prev/next/today) | **NATIVE** | High |
| 5 | Business hours only | **PARTIAL** — grey-out only, no hiding | Medium |
| 6 | Custom time ruler (30-min ticks) | **NATIVE** | High |
| 7 | Real-time updates (SSE) | **NATIVE** — controlled component pattern | High |
| 8 | Role-based (read-only mode) | **NATIVE** | High |
| 9 | Overlapping items side-by-side | **NOT SUPPORTED** — stacking only | Low |
| 10 | Current-time indicator | **NATIVE** | High |

---

## Detailed Analysis

### 1. Multiple Groups/Lanes (NATIVE)

Groups are a core feature. Define lanes as an array:

```typescript
const groups = [
  { id: 'RT', title: 'Radiographic Testing', stackItems: true },
  { id: 'UT', title: 'Ultrasonic Testing', stackItems: true },
  { id: 'ET', title: 'Eddy Current Testing', stackItems: true },
  { id: 'MT', title: 'Magnetic Particle Testing', stackItems: true },
  { id: 'PT', title: 'Penetrant Testing', stackItems: true },
  { id: 'VT', title: 'Visual Testing', stackItems: true },
];
```

Each group can have individual `stackItems`, `height`, and rendering overrides.

---

### 2. Custom Item Rendering (NATIVE)

The `itemRenderer` prop provides full control over item appearance:

```typescript
itemRenderer={({ item, itemContext, getItemProps, getResizeProps }) => {
  const { left: leftResizeProps, right: rightResizeProps } = getResizeProps();
  return (
    <div
      {...getItemProps({
        style: {
          backgroundColor: item.priorityColor,
          borderColor: item.statusBorder,
        },
      })}
    >
      {itemContext.useResizeHandle && <div {...leftResizeProps} />}
      <div className="job-card">
        <span className="status-badge">{item.status}</span>
        <span className="customer">{item.customerName}</span>
        <span className="part-number">{item.partNumber}</span>
      </div>
      {itemContext.useResizeHandle && <div {...rightResizeProps} />}
    </div>
  );
}}
```

**Confidence: High** — Full render control with prop getters pattern.

---

### 3. Drag-and-Drop (NATIVE)

Fully supported with fine-grained control:

| Prop | Purpose |
|------|---------|
| `canMove` | Global enable/disable dragging |
| `canResize` | Enable left/right/both resize handles |
| `canChangeGroup` | Allow items to move between lanes |
| `onItemMove` | Callback: `(itemId, dragTime, newGroupOrder) => void` |
| `onItemResize` | Callback: `(itemId, time, edge) => void` |
| `onItemDrag` | Real-time drag feedback |
| `dragSnap` | Snap interval (default 15 min) |
| `moveResizeValidator` | Custom validation logic |

Per-item overrides possible by setting `canMove`, `canChangeGroup` on individual items.

---

### 4. Day Navigation (NATIVE)

Use controlled mode with `visibleTimeStart` / `visibleTimeEnd`:

```typescript
const [visibleRange, setVisibleRange] = useState({
  start: dayjs().startOf('day').valueOf(),
  end: dayjs().endOf('day').valueOf(),
});

const goToNextDay = () => setVisibleRange(prev => ({
  start: dayjs(prev.start).add(1, 'day').valueOf(),
  end: dayjs(prev.end).add(1, 'day').valueOf(),
}));

const goToToday = () => setVisibleRange({
  start: dayjs().startOf('day').valueOf(),
  end: dayjs().endOf('day').valueOf(),
});
```

---

### 5. Business Hours Display (PARTIAL)

**Cannot hide non-business hours entirely.** The timeline renders a continuous time axis.

**Available workarounds:**

1. **Grey-out styling** via custom header rendering:
   ```typescript
   <DateHeader
     unit="hour"
     labelFormat={([startTime]) => {
       const hour = dayjs(startTime).hour();
       return { className: hour < 8 || hour >= 17 ? 'non-business' : '' };
     }}
   />
   ```

2. **Constrain visible range** to business hours only — but users can still scroll outside.

3. **Snap validation** to prevent items being placed outside business hours:
   ```typescript
   moveResizeValidator={(action, item, time) => {
     const hour = dayjs(time).hour();
     if (hour < 8) return dayjs(time).hour(8).valueOf();
     if (hour >= 17) return dayjs(time).hour(17).valueOf();
     return time;
   }}
   ```

**Confidence: Medium** — Visual differentiation possible; true hiding not supported.

---

### 6. Custom Time Ruler (NATIVE)

Use `timeSteps` prop and custom `DateHeader`:

```typescript
<Timeline
  timeSteps={{
    second: 1,
    minute: 30,  // 30-minute intervals
    hour: 1,
    day: 1,
    month: 1,
    year: 1,
  }}
>
  <TimelineHeaders>
    <DateHeader unit="hour" labelFormat="HH:00" />
    <DateHeader
      unit="minute"
      intervalRenderer={({ getIntervalProps, intervalContext }) => (
        <div {...getIntervalProps()}>
          {dayjs(intervalContext.interval.startTime).format('HH:mm')}
        </div>
      )}
    />
  </TimelineHeaders>
</Timeline>
```

**Note:** Beta issue #946 reports `timeSteps` not rendering properly in some v0.30 betas — verify with your version.

---

### 7. Real-Time Updates via SSE (NATIVE)

react-calendar-timeline is a controlled component — it re-renders when props change:

```typescript
// SSE integration pattern
useEffect(() => {
  const eventSource = new EventSource('/api/schedule/stream');
  
  eventSource.onmessage = (event) => {
    const update = JSON.parse(event.data);
    setItems(prev => {
      // Add, update, or remove items based on SSE payload
      return applyUpdate(prev, update);
    });
  };
  
  return () => eventSource.close();
}, []);
```

**Important:** The library requires new array instances (immutability) to detect changes. Do not mutate `items` in place.

**Confidence: High** — Standard React state management.

---

### 8. Role-Based Read-Only Mode (NATIVE)

```typescript
<Timeline
  canMove={userRole !== 'viewer'}
  canResize={userRole !== 'viewer'}
  canChangeGroup={userRole !== 'viewer'}
  canSelect={userRole !== 'viewer'}
  items={items.map(item => ({
    ...item,
    canMove: userRole !== 'viewer',
    canResize: userRole !== 'viewer',
  }))}
/>
```

**Confidence: High** — Granular permission control at global and item level.

---

### 9. Overlapping Items Side-by-Side (NOT SUPPORTED)

**This is the critical limitation.**

The library offers two modes:
- `stackItems: true` — overlapping items stack vertically (row height increases)
- `stackItems: false` — overlapping items overlap visually (one hides behind another)

**There is no native side-by-side column rendering** like Google Calendar or Outlook.

**Workarounds attempted by community:**
- Custom CSS with `itemRenderer` to offset items horizontally — unreliable, breaks drag
- Pre-processing items to create synthetic sub-groups — complex, loses cross-group drag

**Confidence: Low** — Fundamental architecture limitation. Would require forking the library or choosing an alternative (Planby, DHTMLX, Mobiscroll).

---

### 10. Current-Time Indicator (NATIVE)

Built-in `TodayMarker` component:

```typescript
<Timeline>
  <TimelineMarkers>
    <TodayMarker>
      {({ styles }) => (
        <div style={{ ...styles, backgroundColor: 'red', width: '2px' }} />
      )}
    </TodayMarker>
  </TimelineMarkers>
</Timeline>
```

Auto-updates position. Can be styled with any color/width.

---

## Version and Maintenance Status

| Metric | Value |
|--------|-------|
| **Latest Stable** | v0.28.0 (May 30, 2024) |
| **Latest Beta** | v0.30.0-beta.18 (March 4, 2025) |
| **GitHub Stars** | 2,100+ |
| **Open Issues** | 1 (as of April 2026) |
| **License** | MIT |
| **Maintenance** | Active — maintainer seeking help |

### Stable vs Beta Decision

| Use Stable (0.28.x) | Use Beta (0.30.x) |
|---------------------|-------------------|
| Production-critical, no risk tolerance | Greenfield project, can handle breaking changes |
| Need moment.js compatibility | Want dayjs (smaller bundle) |
| React 16/17 required | React 18+ acceptable |
| TypeScript types via @types package | Bundled TypeScript definitions |

**Recommendation for ndtv1:** Use **v0.30.0-beta.18** — the TypeScript rewrite and dayjs migration align with your stack, and beta stability has improved significantly (only 1 open issue).

---

## Bundle Size Analysis

### Stable (v0.28.0) with moment.js

| Package | Minified | Gzipped |
|---------|----------|---------|
| react-calendar-timeline | ~65 KB | ~18 KB |
| moment.js (peer dep) | ~130 KB | ~48 KB |
| **Total** | ~195 KB | ~66 KB |

### Beta (v0.30.x) with dayjs

| Package | Minified | Gzipped |
|---------|----------|---------|
| react-calendar-timeline | ~55 KB | ~16 KB |
| dayjs (peer dep) | ~7 KB | ~3 KB |
| **Total** | ~62 KB | ~19 KB |

**Bundle savings with beta: ~70% reduction** (66 KB -> 19 KB gzipped).

### Peer Dependencies (v0.30.x)

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `dayjs` >= 1.11.0
- `interactjs` >= 1.10.0

---

## dayjs Integration

### Is dayjs required?

| Version | Date Library | Required? |
|---------|--------------|-----------|
| 0.28.x (stable) | moment.js | Yes, peer dependency |
| 0.30.x (beta) | dayjs | Yes, peer dependency |

### Migration from moment.js

If using beta, update date handling:

```typescript
// Before (moment)
import moment from 'moment';
const start = moment().startOf('day');

// After (dayjs)
import dayjs from 'dayjs';
const start = dayjs().startOf('day');
```

API is nearly identical. dayjs plugins may be needed for advanced formatting:

```typescript
import advancedFormat from 'dayjs/plugin/advancedFormat';
dayjs.extend(advancedFormat);
```

### dayjs Fork Alternative

If you need an earlier version with dayjs, `@rikkeisoft/react-calendar-timeline-dayjs` exists but is not actively maintained. Prefer the official beta.

---

## Known Limitations and Gotchas

### Critical

1. **No side-by-side overlapping items** — only stacking or visual overlap
2. **Cannot hide non-business hours** — only grey-out styling

### Performance

3. **Performance degrades at ~50+ visible items** with `fullUpdate=true`
4. **Virtualization not built-in** — consider Planby if you have 1000+ items

### Beta-Specific

5. **`timeSteps` regression in early betas** — fixed in recent releases, but verify
6. **CSS import path changed** — `'react-calendar-timeline/style.css'` not `/lib/Timeline.css`
7. **ImmutableJS no longer supported** — use plain arrays

### Browser/Platform

8. **Trackpad horizontal scroll** can hijack vertical page scroll (fixed in beta.17+)
9. **Safari jitter** during scroll (fixed in beta.15+ via CSS transforms)
10. **TodayMarker + multiple timelines** can cause snap-back issues

---

## NDT Portal Implications

### What Works Well

- **6 inspection type lanes** — trivial to implement
- **Custom job cards** — full render control for priority, status, customer, part number
- **Drag rescheduling** — native, with snap-to-30-min and validation
- **Day view navigation** — controlled component pattern fits your existing state management
- **SSE integration** — standard React pattern, no library-specific concerns
- **Role-based access** — props for read-only mode

### What Needs Work

- **Business hours (08:00-17:00)** — implement grey-out styling + move validation; users can still scroll to see non-business hours
- **Overlapping jobs** — if two RT jobs overlap, they will stack vertically (row expands) rather than display side-by-side

### Architecture Fit

Your existing stack:
- Next.js 14 + TypeScript — compatible
- Zustand state — works with controlled component pattern
- SSE for real-time — standard integration
- 60 FPS target — achievable with < 50 visible items per render

---

## Recommendations

### If Overlapping Side-by-Side is REQUIRED

**Do not use react-calendar-timeline.** Consider:

| Library | Side-by-Side | License | Bundle |
|---------|--------------|---------|--------|
| **Planby** | Yes | MIT + Pro | ~40 KB |
| **DHTMLX Scheduler** | Yes | GPL/Commercial | ~150 KB |
| **Mobiscroll** | Yes | Commercial | ~80 KB |

### If Stacking is ACCEPTABLE

**Use react-calendar-timeline v0.30.0-beta.18** with these customizations:

1. Custom `itemRenderer` for job card styling
2. `moveResizeValidator` to enforce business hours
3. Grey-out CSS for non-business hour columns
4. `TodayMarker` styled red
5. Controlled state with SSE updates

### Implementation Priority

1. Prototype with sample data (1-2 days)
2. Validate stacking behavior with real overlapping scenarios
3. If stacking is acceptable, proceed
4. If not, evaluate Planby (best alternative for your requirements)

---

## Sources

| # | URL | Type | Used For |
|---|-----|------|----------|
| 1 | [GitHub Repository](https://github.com/namespace-ee/react-calendar-timeline) | Primary | Features, maintenance, issues |
| 2 | [npm Package](https://www.npmjs.com/package/react-calendar-timeline) | Primary | Version, dependencies |
| 3 | [Releases Page](https://github.com/namespace-ee/react-calendar-timeline/releases) | Primary | Version history, changelog |
| 4 | [CHANGELOG.md](https://github.com/namespace-ee/react-calendar-timeline/blob/master/CHANGELOG.md) | Primary | Breaking changes, migration |
| 5 | [Issue #420 - Overlapping Items](https://github.com/namespace-ee/react-calendar-timeline/issues/420) | Primary | Stacking limitations |
| 6 | [Issue #946 - timeSteps](https://github.com/namespace-ee/react-calendar-timeline/issues/946) | Primary | Beta bugs |
| 7 | [HackMD Documentation](https://hackmd.io/@0udF7NqaRtCpwXsfTascjQ/BJxxjhEnD) | Secondary | itemRenderer examples |
| 8 | [Planby](https://planby.app/) | Secondary | Alternative comparison |
| 9 | [dayjs vs moment comparison](https://garbagevalue.com/blog/dayjs-the-best-lightweight-alternative-to-momentjs) | Secondary | Bundle size |
| 10 | [@rikkeisoft/react-calendar-timeline-dayjs](https://www.npmjs.com/package/@rikkeisoft/react-calendar-timeline-dayjs) | Secondary | dayjs fork option |

---

## Appendix: Quick Reference

### Installation (Beta)

```bash
npm install react-calendar-timeline@beta dayjs interactjs
```

### Minimal Setup

```typescript
import Timeline, {
  TimelineHeaders,
  DateHeader,
  TimelineMarkers,
  TodayMarker,
} from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import dayjs from 'dayjs';

const groups = [
  { id: 'RT', title: 'Radiographic Testing' },
  { id: 'UT', title: 'Ultrasonic Testing' },
  // ... other inspection types
];

const items = [
  {
    id: 1,
    group: 'RT',
    title: 'Job #1234',
    start_time: dayjs().hour(9).valueOf(),
    end_time: dayjs().hour(11).valueOf(),
    canMove: true,
    canResize: true,
    canChangeGroup: true,
  },
];

<Timeline
  groups={groups}
  items={items}
  visibleTimeStart={dayjs().startOf('day').valueOf()}
  visibleTimeEnd={dayjs().endOf('day').valueOf()}
  onItemMove={(itemId, dragTime, newGroupOrder) => {
    // Handle move
  }}
  stackItems
>
  <TimelineHeaders>
    <DateHeader unit="hour" />
  </TimelineHeaders>
  <TimelineMarkers>
    <TodayMarker />
  </TimelineMarkers>
</Timeline>
```
