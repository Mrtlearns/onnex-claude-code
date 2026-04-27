"use client"

import * as React from "react"
import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, Handshake,
  FileText, Clock, File, BarChart2, Shield, Bell, Bot, Settings2,
  ExternalLink, Menu, BrainCircuit, Brain, Zap, SlidersHorizontal,
  Pin, PinOff,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { canAccess } from "@/lib/rbac"
import type { UserRole } from "@/lib/rbac"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard, permission: "read:all",        phase: 10 },
  { label: "Clients",       href: "/clients",       icon: Users,           permission: "write:clients",   phase: 8  },
  { label: "Projects",      href: "/projects",      icon: FolderKanban,    permission: "read:all",        phase: 8  },
  { label: "Tasks",         href: "/tasks",         icon: CheckSquare,     permission: "write:tasks",     phase: 8  },
  { label: "Deals",         href: "/deals",         icon: Handshake,       permission: "write:deals",     phase: 9  },
  { label: "Invoices",      href: "/invoices",      icon: FileText,        permission: "write:invoices",  phase: 9  },
  { label: "Time Tracking", href: "/time-tracking", icon: Clock,           permission: "write:tasks",     phase: 9  },
  { label: "Documents",     href: "/documents",     icon: File,            permission: "read:documents",  phase: 10 },
  { label: "Reports",       href: "/reports",       icon: BarChart2,       permission: "read:reports",    phase: 11 },
  { label: "Notifications", href: "/notifications", icon: Bell,            permission: "read:all",        phase: 10 },
  { label: "AI Assistant",  href: "/ai",            icon: Bot,             permission: "read:all",        phase: 12 },
  { label: "SOPs",          href: "/ai-brain",      icon: Brain,           permission: "read:all",        phase: 12 },
  // DEV NOTE: brain-cognitive is an optional feature module — remove this line + the brain-cognitive dirs to disable
  { label: "BRAIN",         href: "/brain-cognitive", icon: BrainCircuit,  permission: "read:all",        phase: 12 },
  { label: "Tools",           href: "/tools",                 icon: Zap,               permission: "manage:all", phase: 12 },
  { label: "System Settings", href: "/admin/system-settings", icon: SlidersHorizontal, permission: "manage:all", phase: 12 },
  { label: "Admin",           href: "/admin",                 icon: Shield,            permission: "manage:all", phase: 11 },
  { label: "Settings",        href: "/settings",              icon: Settings2,         permission: "read:all",   phase: 12 },
  { label: "Client Portal", href: "/portal",        icon: ExternalLink,    permission: "read:own_portal", phase: 12 },
] as const

function SidebarNav({ role, open }: { role: UserRole | undefined; open: boolean }) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => canAccess(role, item.permission))

  // Most-specific match wins — prevents /admin matching when /admin/system-settings is active
  const activeHref = visibleItems
    .filter(i => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <ScrollArea className="flex-1 px-3">
      <nav className="space-y-1 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === activeHref
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={!open ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(
                "whitespace-nowrap overflow-hidden transition-[opacity,transform] duration-200",
                open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </ScrollArea>
  )
}

interface SidebarProps {
  // session may be passed from server layouts — useSession() is the canonical source inside this component
  session?: unknown
}

export function Sidebar({ }: SidebarProps) {
  const { data: session } = useSession()
  const role = session?.user?.role as UserRole | undefined

  const [pinned, setPinnedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_pinned') === 'true'
  })
  const [hovering, setHovering] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = pinned || hovering

  function handleMouseEnter() {
    if (pinned) return
    hoverTimer.current = setTimeout(() => setHovering(true), 80)
  }
  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (!pinned) setHovering(false)
  }
  function togglePin() {
    const next = !pinned
    setPinnedState(next)
    localStorage.setItem('sidebar_pinned', String(next))
    if (!next) setHovering(false)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "hidden shrink-0 md:flex md:flex-col transition-[width] duration-200 ease-in-out overflow-hidden border-r bg-background",
          open ? "w-[220px]" : "w-14"
        )}
      >
        {/* Logo / wordmark */}
        <div className="flex h-14 items-center border-b px-4 overflow-hidden">
          <span className="text-lg font-bold text-primary shrink-0">A</span>
          <span className={cn(
            "ml-2 text-lg font-bold text-primary whitespace-nowrap transition-[opacity,transform] duration-200",
            open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
          )}>I-OS</span>
        </div>

        {/* Nav items */}
        <SidebarNav role={role} open={open} />

        {/* Pin button — only visible when expanded */}
        <div className={cn(
          "border-t px-3 py-2 transition-[opacity] duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <button
            onClick={togglePin}
            className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          >
            {pinned
              ? <PinOff className="h-3.5 w-3.5 shrink-0" />
              : <Pin className="h-3.5 w-3.5 shrink-0" />
            }
            <span className="whitespace-nowrap overflow-hidden">
              {pinned ? "Unpin" : "Pin sidebar"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile hamburger sheet */}
      <div className="flex items-center md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            {/* Mobile sheet gets a simple always-expanded nav */}
            <div className="flex h-full flex-col border-r bg-background">
              <div className="flex h-14 items-center border-b px-4">
                <span className="text-lg font-bold text-primary">AI-OS</span>
              </div>
              <SidebarNav role={role} open={true} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
