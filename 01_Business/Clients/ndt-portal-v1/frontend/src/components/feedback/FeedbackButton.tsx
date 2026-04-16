import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import FeedbackModal from './FeedbackModal'

/**
 * Feedback icon button for the Topbar — renders a modal on click.
 * Matches the QuickBtn visual style from Topbar.tsx but is a button (not a NavLink).
 */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title="Send feedback"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
        <span>Feedback</span>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
