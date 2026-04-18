// apps/web/src/app/(portal)/layout.tsx
// Portal route group layout — distinct header, no agency sidebar
// Visible to client_viewer role only (middleware enforces this)

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { apiGetPortalMe } from "@/lib/api-client"
import type { PortalMe } from "@/types/api"

export const dynamic = "force-dynamic"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Portal is for client_viewer role only — internal staff go to dashboard
  if (session.user.role !== "client_viewer") {
    redirect("/dashboard")
  }

  let portalMe: PortalMe | null = null
  try {
    portalMe = await apiGetPortalMe(session.user.token)
  } catch {
    // Graceful degradation — client mapping may not be set up yet
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agency Portal</h1>
          {portalMe && (
            <p className="text-sm text-muted-foreground">{portalMe.client_name}</p>
          )}
        </div>
        <nav className="flex gap-6">
          <Link href="/portal/projects" className="text-sm hover:underline">
            Projects
          </Link>
          <Link href="/portal/invoices" className="text-sm hover:underline">
            Invoices
          </Link>
          <Link href="/portal/documents" className="text-sm hover:underline">
            Documents
          </Link>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
