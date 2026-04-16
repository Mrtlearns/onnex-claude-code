import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SimulationPanel } from '@/components/workshop/SimulationPanel'
import '@/components/workshop/workshop-theme.css'

export default function WorkshopSimulationPage() {
  return (
    <div className="min-h-full bg-[var(--ws-bg-primary)]">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--ws-lane-border)] bg-[var(--ws-bg-secondary)]">
        <Link
          to="/workshop"
          className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-[var(--ws-text-primary)]">Simulation</h1>
      </div>
      <SimulationPanel />
    </div>
  )
}
