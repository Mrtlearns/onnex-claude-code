import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a human-readable relative time string for a given date,
 * e.g. "2 hours ago", "just now", "3 days ago".
 * No external dependency — uses plain JS arithmetic.
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  }
  if (diffSec < 86400 * 7) {
    const d2 = Math.floor(diffSec / 86400)
    return `${d2} ${d2 === 1 ? 'day' : 'days'} ago`
  }
  if (diffSec < 86400 * 30) {
    const w = Math.floor(diffSec / (86400 * 7))
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`
  }
  if (diffSec < 86400 * 365) {
    const mo = Math.floor(diffSec / (86400 * 30))
    return `${mo} ${mo === 1 ? 'month' : 'months'} ago`
  }
  const y = Math.floor(diffSec / (86400 * 365))
  return `${y} ${y === 1 ? 'year' : 'years'} ago`
}
