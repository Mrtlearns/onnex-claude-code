// apps/web/src/app/(protected)/ai/knowledge-graph/page.tsx
import { auth } from "@/auth"
import { KgPageClient } from "./components/kg-page-client"

export default async function KnowledgeGraphPage() {
  const session = await auth()
  return <KgPageClient session={session} />
}
