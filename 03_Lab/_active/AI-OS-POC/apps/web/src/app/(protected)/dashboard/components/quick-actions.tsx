"use client"
// apps/web/src/app/(protected)/dashboard/components/quick-actions.tsx
// 4 static shortcut buttons — navigate to correct routes/dialogs

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, UserPlus, Clock, Upload } from "lucide-react"

const ACTIONS = [
  {
    label: "New Task",
    icon: Plus,
    href: "/tasks?create=1",
  },
  {
    label: "New Client",
    icon: UserPlus,
    href: "/clients?create=1",
  },
  {
    label: "Log Time",
    icon: Clock,
    href: "/time-tracking",
  },
  {
    label: "Upload Document",
    icon: Upload,
    href: "/documents?upload=1",
  },
]

export function QuickActions() {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {ACTIONS.map(({ label, icon: Icon, href }) => (
            <Button
              key={label}
              variant="outline"
              className="h-auto flex flex-col items-center gap-1 py-3 text-xs"
              onClick={() => router.push(href)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
