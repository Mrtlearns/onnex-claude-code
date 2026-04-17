// apps/web/src/app/(protected)/ai/page.tsx
import { auth } from "@/auth"
import { AiPageClient } from "./components/ai-page-client"

export default async function AIAssistantPage() {
  const session = await auth()
  return <AiPageClient session={session} />
}
