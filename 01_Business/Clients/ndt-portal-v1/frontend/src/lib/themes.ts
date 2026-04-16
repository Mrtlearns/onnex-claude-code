// ── NDT Portal Theme Registry ─────────────────────────────────────────────────
// To add a new theme:
//   1. Add two CSS blocks in src/index.css:
//      [data-theme="yourtheme"] { ... }   ← light variant
//      .dark[data-theme="yourtheme"] { ... }  ← dark variant
//   2. Register it here in THEMES

export interface ThemeConfig {
  id: string
  label: string
  description: string
}

export const THEMES: ThemeConfig[] = [
  { id: 'morpheus', label: 'Morpheus', description: 'Deep green dark theme' },
  { id: 'warm',     label: 'Warm',     description: 'Soft warm-toned professional' },
]

export const DEFAULT_THEME = 'morpheus'
