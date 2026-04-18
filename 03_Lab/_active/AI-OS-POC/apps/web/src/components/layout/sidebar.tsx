"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, Handshake,
  FileText, Clock, File, BarChart2, Shield, Bell, Bot, Settings2,
  ExternalLink, Menu, BrainCircuit, Brain, Zap,
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
  { label: "Time Tracking", href: "/time-tracking",          icon: Clock,           permission: "write:tasks",     phase: 9  },
  { label: "Documents",     href: "/documents",     icon: File,            permission: "read:documents",  phase: 10 },
  { label: "Reports",       href: "/reports",       icon: BarChart2,       permission: "read:reports",    phase: 11 },
  { label: "Admin",         href: "/admin",         icon: Shield,          permission: "manage:all",      phase: 11 },
  { label: "Notifications", href: "/notifications", icon: Bell,            permission: "read:all",        phase: 10 },
  { label: "AI Assistant",  href: "/ai",            icon: Bot,             permission: "read:all",        phase: 12 },
  { label: "SOPs",          href: "/ai-brain",      icon: Brain,           permission: "read:all",        phase: 12 },
  // DEV NOTE: brain-cognitive is an optional feature module — remove this line + the brain-cognitive dirs to disable
  { label: "BRAIN",         href: "/brain-cognitive", icon: BrainCircuit,  permission: "read:all",        phase: 12 },
  { label: "Skills",        href: "/tools",         icon: Zap,             permission: "manage:all",      phase: 12 },
  { label: "Settings",      href: "/settings",      icon: Settings2,       permission: "manage:all",      phase: 12 },
  { label: "Client Portal", href: "/portal",        icon: ExternalLink,    permission: "read:own_portal", phase: 12 },
] as const

function SidebarNav({ role, collapsed }: { role: UserRole | undefined; collapsed?: boolean }) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => canAccess(role, item.permission))

  return (
    <ScrollArea className="flex-1 px-3">
      <nav className="space-y-1 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
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
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>
    </ScrollArea>
  )
}

function SidebarContent({ role, collapsed }: { role: UserRole | undefined; collapsed?: boolean }) {
  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && <span className="text-lg font-bold text-primary">AI-OS</span>}
        {collapsed && <span className="text-lg font-bold text-primary">A</span>}
      </div>
      <SidebarNav role={role} collapsed={collapsed} />
    </div>
  )
}

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  // session may be passed from server layouts — useSession() is the canonical source inside this component
  session?: unknown
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { data: session } = useSession()
  const role = session?.user?.role as UserRole | undefined

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden shrink-0 md:flex md:flex-col transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent role={role} collapsed={collapsed} />
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center h-10 border-t border-r bg-background text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
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
            <SidebarContent role={role} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
