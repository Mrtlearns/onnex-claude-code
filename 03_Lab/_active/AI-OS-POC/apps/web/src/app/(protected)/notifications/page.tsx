// apps/web/src/app/(protected)/notifications/page.tsx
import { auth } from "@/auth"
import { NotificationsClient } from "./components/notifications-client"

export default async function NotificationsPage() {
  const session = await auth()
  return <NotificationsClient session={session} />
}
