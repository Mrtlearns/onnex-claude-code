import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { CommandMenu } from "@/components/command-menu"
import { Toaster } from "sonner"

export const dynamic = "force-dynamic"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.error === "RefreshAccessTokenError") {
    redirect("/api/auth/signout")
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header session={session} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <CommandMenu />
      <Toaster richColors position="bottom-right" />
    </div>
  )
}
