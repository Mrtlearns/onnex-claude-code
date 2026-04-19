import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SettingsClient } from "./components/settings-client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/dashboard")
  return <SettingsClient />
}
