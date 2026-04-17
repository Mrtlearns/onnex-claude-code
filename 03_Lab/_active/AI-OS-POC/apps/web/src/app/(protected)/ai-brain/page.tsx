// apps/web/src/app/(protected)/ai-brain/page.tsx
import { auth } from "@/auth"
import { AiBrainClient } from "./components/ai-brain-client"

export default async function AiBrainPage() {
  const session = await auth()
  return <AiBrainClient session={session} />
}
