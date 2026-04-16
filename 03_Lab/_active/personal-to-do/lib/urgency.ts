/**
 * Returns an urgency glow color based on proximity to due_date.
 * Returns null if no due date or due date is more than 7 days away.
 */
export function getDueDateGlow(dueDate: Date | string | null): string | null {
  if (!dueDate) return null
  const msLeft = new Date(dueDate).getTime() - Date.now()
  const daysLeft = msLeft / (1000 * 60 * 60 * 24)
  if (daysLeft < 0) return '#ef4444'    // overdue — red
  if (daysLeft < 1) return '#f97316'    // today — orange-red
  if (daysLeft < 3) return '#fb923c'    // 1–3 days — orange
  if (daysLeft < 7) return '#fbbf24'    // this week — amber
  return null
}
