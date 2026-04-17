// ─────────────────────────────────────────────────────────────────────────────
// /brain-cognitive — BRAIN Cognitive Architecture Dashboard
// DEV NOTE: Optional feature module. See src/components/brain-cognitive/README
//           for removal instructions.
// ─────────────────────────────────────────────────────────────────────────────

import { BrainDashboard } from "@/components/brain-cognitive"

export const metadata = {
  title: "BRAIN | AI-OS",
}

export default function BrainCognitivePage() {
  return (
    <div className="flex flex-col h-full p-4 min-h-0">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold">BRAIN</h1>
        <p className="text-sm text-muted-foreground">
          Cognitive architecture — knowledge graph, memory sectors, and synaptic activity
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <BrainDashboard />
      </div>
    </div>
  )
}
