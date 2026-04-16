import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import type { Session } from "next-auth"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if ((session as Session & { error?: string }).error === "RefreshAccessTokenError") {
    redirect("/api/auth/signout?callbackUrl=/login")
  }

  return <AppShell session={session as Session}>{children}</AppShell>
}
