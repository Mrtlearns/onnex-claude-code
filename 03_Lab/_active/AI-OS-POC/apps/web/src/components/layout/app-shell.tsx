"use client"

import * as React from "react"
import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useUIStore } from "@/stores/ui-store"

interface AppShellProps {
  session: Session
  children: React.ReactNode
}

export function AppShell({ session, children }: AppShellProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header session={session} onMenuClick={toggleSidebar} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
