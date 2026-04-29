/**
 * Single source of truth for the product name. Import from here whenever
 * you render the brand in UI so future renames are a one-file change.
 *
 * Note on storage keys: the `vci.*` localStorage prefix and `vci-assets`
 * IndexedDB name predate this rename. They are intentionally kept to
 * preserve existing admin drafts, history, and uploads.
 */
export const BRAND = {
  name: "On-Nex Training Portal",
  short: "On-Nex",
  tagline: "Claude Code Workshop",
} as const;
