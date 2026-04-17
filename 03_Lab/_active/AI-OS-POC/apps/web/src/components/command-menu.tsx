"use client"
// Global ⌘K command palette — navigation + quick actions
// Wired into (protected)/layout.tsx

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { NAV_ITEMS } from "@/components/layout/sidebar"
import {
  Plus,
  UserPlus,
  TrendingUp,
  Search,
  Keyboard,
} from "lucide-react"

const QUICK_ACTIONS = [
  { label: "New Task", href: "/tasks?create=1", icon: Plus },
  { label: "New Client", href: "/clients?create=1", icon: UserPlus },
  { label: "New Deal", href: "/deals?create=1", icon: TrendingUp },
]

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const run = useCallback(
    (cb: () => void) => {
      setOpen(false)
      // small delay lets dialog close first
      setTimeout(cb, 50)
    },
    []
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-[560px]">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          {/* Search input */}
          <div className="flex items-center border-b px-3 gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search pages and actions..."
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden py-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick actions */}
            <Command.Group heading="Quick Actions">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                <Command.Item
                  key={label}
                  value={label}
                  onSelect={() => run(() => router.push(href))}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigate">
              {(NAV_ITEMS as readonly typeof NAV_ITEMS[number][]).map((item) => {
                const Icon = item.icon
                return (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => run(() => router.push(item.href))}
                    className="flex cursor-pointer select-none items-center gap-2 rounded-md text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {item.label}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-end gap-3 border-t px-4 py-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Keyboard className="h-3 w-3" />
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">esc</kbd>
              to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
