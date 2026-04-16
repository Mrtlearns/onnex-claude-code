/** Format relative due date string */
export function formatRelativeDue(dueDate: string | null): { text: string; overdue: boolean } {
  if (!dueDate) return { text: 'No due date', overdue: false }
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffH = diffMs / (1000 * 60 * 60)

  if (diffH < 0) {
    const absH = Math.abs(diffH)
    if (absH < 24) return { text: `Overdue ${Math.round(absH)}h`, overdue: true }
    return { text: `Overdue ${Math.round(absH / 24)}d`, overdue: true }
  }
  if (diffH < 1) return { text: `Due in ${Math.round(diffH * 60)}m`, overdue: false }
  if (diffH < 24) return { text: `Due in ${Math.round(diffH)}h`, overdue: false }
  if (diffH < 48) return { text: 'Due tomorrow', overdue: false }
  return { text: `Due in ${Math.round(diffH / 24)}d`, overdue: false }
}
