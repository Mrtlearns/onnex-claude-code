"use client"
import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { FeedbackModal } from "./FeedbackModal"

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors"
        title="Send feedback"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span>Feedback</span>
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
