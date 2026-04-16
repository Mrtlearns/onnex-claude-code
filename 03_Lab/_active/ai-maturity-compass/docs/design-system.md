# Design System

## Typography

| Role | Font | Usage |
|------|------|-------|
| Display | **Space Grotesk** | Headings, scores, badges, navigation |
| Body | **DM Sans** | Paragraph text, form labels, descriptions |

Configured in `tailwind.config.ts` → `fontFamily`.

## Color Palette

All colors use HSL values defined in `src/index.css` as CSS custom properties.

### Core Semantic Tokens

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `210 40% 98%` | Page background |
| `--foreground` | `240 28% 14%` | Primary text |
| `--card` | `0 0% 100%` | Card surfaces |
| `--primary` | `217 72% 21%` | Navy — buttons, headers |
| `--primary-foreground` | `210 40% 98%` | Text on primary |
| `--secondary` | `210 25% 93%` | Subtle backgrounds |
| `--accent` | `174 100% 35%` | Teal — CTAs, highlights |
| `--muted` | `210 25% 93%` | Disabled/subtle states |
| `--destructive` | `0 84% 60%` | Errors, deletions |

### Brand Tokens

| Token | Color | Usage |
|-------|-------|-------|
| `--navy` | `217 72% 21%` | Primary brand color |
| `--navy-light` | `217 55% 32%` | Hover/lighter navy |
| `--teal` | `174 100% 35%` | Accent/CTA color |
| `--gold` | `41 100% 47%` | Score highlights, warnings |
| `--success` | `142 71% 45%` | Positive states |
| `--warning` | `38 92% 50%` | Caution states |
| `--danger` | `0 84% 60%` | Error/critical states |

### Maturity Stage Colors

| Stage | Badge Classes |
|-------|--------------|
| Nascent | `bg-red-100 text-red-700` |
| Developing | `bg-amber-100 text-amber-700` |
| Scaling | `bg-yellow-100 text-yellow-700` |
| Optimized | `bg-emerald-100 text-emerald-700` |
| Transforming | `bg-green-100 text-green-700` |

## Spacing & Layout

- Container: max `1400px`, centered, `2rem` padding
- Border radius: `0.75rem` (lg), `calc(0.75rem - 2px)` (md), `calc(0.75rem - 4px)` (sm)
- Cards use `shadow-card` and `border-border/50`

## Animations

| Name | Effect | Duration |
|------|--------|----------|
| `fade-in` | Translate up 8px + opacity | 0.4s ease-out |
| `scale-in` | Scale from 0.95 + opacity | 0.3s ease-out |
| `accordion-down/up` | Height expand/collapse | 0.2s ease-out |

## Component Library

Built on [shadcn/ui](https://ui.shadcn.com/) with Radix UI primitives:

- Accordion, Alert, AlertDialog, Avatar, Badge
- Button, Calendar, Card, Carousel, Chart
- Checkbox, Collapsible, Command, ContextMenu
- Dialog, Drawer, DropdownMenu, Form
- HoverCard, Input, Label, Menubar
- NavigationMenu, Pagination, Popover, Progress
- RadioGroup, ScrollArea, Select, Separator
- Sheet, Sidebar, Skeleton, Slider
- Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip

## Usage Guidelines

1. **Never use raw color values** — always reference semantic tokens
2. **Use `font-display`** for headings and `font-body` for text
3. **Cards**: Always use `shadow-card border-border/50` for consistency
4. **Status badges**: Use the maturity stage color map from `mock-data.ts`
5. **Icons**: Lucide React exclusively — no other icon libraries
