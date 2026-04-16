"use client"
// apps/web/src/app/(protected)/time-tracking/components/log-time-button.tsx
// "Log Time" button that opens the TimeEntryForm in a Sheet

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { TimeEntryForm } from "./time-entry-form"

export function LogTimeButton() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>Log Time</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Log Time</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <TimeEntryForm
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
