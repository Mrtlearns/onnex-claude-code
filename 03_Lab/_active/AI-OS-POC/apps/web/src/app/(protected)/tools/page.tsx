import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { ToolsClient } from "./tools-client"

export const metadata = { title: "Tools" }

export default async function ToolsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const role = (session.user as { role?: string })?.role ?? ""
  if (!["admin", "super_admin"].includes(role)) redirect("/dashboard")

  return <ToolsClient />
}
