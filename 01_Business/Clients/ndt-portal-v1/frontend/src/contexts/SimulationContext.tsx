import {
  createContext, useContext, useState, useRef, useCallback, useEffect,
  type ReactNode,
} from 'react'
import type { InspectionType, Priority, WorkshopMachine } from '@/lib/workshop/types'
import { INSPECTION_TYPES } from '@/lib/workshop/constants'
import { workshopApi } from '@/lib/workshop/workshopApi'
import { utApi } from '@/lib/api'
import { useAuth } from './AuthContext'

// ── Types ────────────────────────────────────────────────────

export interface SimLogEntry {
  ts: string
  type: 'info' | 'success' | 'error' | 'scan'
  msg: string
}

interface SimStats {
  ordersGenerated: number
  jobsQueued: number
  jobsCompleted: number
}

interface UtCustomer {
  id: string
  name: string
}

interface SimulationContextValue {
  running: boolean
  stats: SimStats
  logs: SimLogEntry[]
  customers: UtCustomer[]
  durationMin: number
  arrivalRateSec: number
  multiInspectPct: number
  activeInspTypes: InspectionType[]
  start: () => void
  stop: () => void
  clearSimData: () => Promise<void>
  clearLogs: () => void
  setDurationMin: (v: number) => void
  setArrivalRateSec: (v: number) => void
  setMultiInspectPct: (v: number) => void
  toggleInspType: (t: InspectionType) => void
}

// ── Context ──────────────────────────────────────────────────

const SimulationContext = createContext<SimulationContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider')
  return ctx
}

// ── Helpers ──────────────────────────────────────────────────

const PRIORITIES: Priority[] = ['high', 'medium', 'low']
const SAMPLE_PARTS = ['FLG-9200', 'WLD-3301', 'PIPE-4422', 'ELB-7100', 'NZL-0850', 'VLV-2240']

function nowTs(): string {
  const d = new Date()
  const date = d.toLocaleDateString('en-CA')  // YYYY-MM-DD
  const time = [d.getHours(), d.getMinutes()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
  return `${date} ${time}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '?'
  const d = new Date(iso)
  return [d.getHours(), d.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':')
}

// ── Provider ─────────────────────────────────────────────────

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<SimStats>({ ordersGenerated: 0, jobsQueued: 0, jobsCompleted: 0 })
  const [logs, setLogs] = useState<SimLogEntry[]>([])
  const [customers, setCustomers] = useState<UtCustomer[]>([])

  // Config
  const [durationMin, setDurationMin] = useState(60)
  const [arrivalRateSec, setArrivalRateSec] = useState(30)
  const [multiInspectPct, setMultiInspectPct] = useState(40)
  const [activeInspTypes, setActiveInspTypes] = useState<InspectionType[]>(['RT', 'UT', 'MT'])

  const [machines, setMachines] = useState<WorkshopMachine[]>([])

  // Timer refs — survive navigation
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const stopTimeRef = useRef<number | null>(null)

  // Stable refs for config values used in tick (avoids stale closure)
  const customersRef = useRef(customers)
  const activeInspTypesRef = useRef(activeInspTypes)
  const multiInspectPctRef = useRef(multiInspectPct)
  const arrivalRateSecRef = useRef(arrivalRateSec)
  const machinesRef = useRef(machines)

  useEffect(() => { customersRef.current = customers }, [customers])
  useEffect(() => { activeInspTypesRef.current = activeInspTypes }, [activeInspTypes])
  useEffect(() => { multiInspectPctRef.current = multiInspectPct }, [multiInspectPct])
  useEffect(() => { arrivalRateSecRef.current = arrivalRateSec }, [arrivalRateSec])
  useEffect(() => { machinesRef.current = machines }, [machines])

  function addLog(type: SimLogEntry['type'], msg: string) {
    setLogs((prev) => [...prev, { ts: nowTs(), type, msg }])
  }

  // Load customers + machines once when auth is ready
  useEffect(() => {
    if (!accessToken) return
    utApi.list<UtCustomer>('customers', { select: 'id,name', order: 'name' })
      .then((rows) => setCustomers(rows))
      .catch(() => {
        setCustomers([
          { id: '45dd5927-1cfc-4e52-a32a-ca36a90753b7', name: 'PREMCO' },
          { id: '00000000-0000-0000-0000-000000000002', name: 'Pacific Inspection' },
        ])
      })
    workshopApi.getMachines()
      .then((m) => setMachines(m))
      .catch(() => {/* machines optional — scheduler falls back to any machine */})
  }, [accessToken])

  const stop = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    scanTimersRef.current.forEach(clearTimeout)
    scanTimersRef.current = []
    stopTimeRef.current = null
  }, [])

  const tick = useCallback(async () => {
    const cust = customersRef.current
    const types = activeInspTypesRef.current
    if (!cust.length || !types.length) return
    if (stopTimeRef.current && Date.now() >= stopTimeRef.current) {
      stop()
      addLog('info', 'Simulation ended — duration elapsed')
      return
    }

    const customer = cust[Math.floor(Math.random() * cust.length)]
    const part = SAMPLE_PARTS[Math.floor(Math.random() * SAMPLE_PARTS.length)]
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
    const useMulti = Math.random() * 100 < multiInspectPctRef.current
    let selectedTypes: InspectionType[]
    if (useMulti && types.length > 1) {
      const shuffled = [...types].sort(() => Math.random() - 0.5)
      selectedTypes = shuffled.slice(0, Math.floor(Math.random() * 2) + 2)
    } else {
      selectedTypes = [types[Math.floor(Math.random() * types.length)]]
    }

    const orderNumber = `SIM-${Date.now().toString(36).toUpperCase()}`

    // Build allowedMachines: for each selected type, pick 1-2 random active machines
    const allMachines = machinesRef.current
    const allowedMachines: Record<string, string[]> = {}
    for (const t of selectedTypes) {
      const forType = allMachines.filter((m) => m.type === t && m.isActive)
      if (forType.length > 0) {
        const shuffled = [...forType].sort(() => Math.random() - 0.5)
        // Assign 1 machine if only 1 available, else 1 or 2
        const pick = forType.length === 1 ? 1 : Math.floor(Math.random() * 2) + 1
        allowedMachines[t] = shuffled.slice(0, pick).map((m) => m.id)
      }
    }

    try {
      const order = await workshopApi.createOrder({
        orderNumber,
        customerId: customer.id,
        partNumber: part,
        quantity: Math.floor(Math.random() * 5) + 1,
        priority,
        dueDate: new Date(Date.now() + (Math.random() * 8 + 2) * 3_600_000).toISOString(),
        inspectionTypes: selectedTypes,
        notes: null,
        isSimulated: true,
        allowedMachines: Object.keys(allowedMachines).length > 0 ? allowedMachines : undefined,
      })

      const jobCount = order.workshopJobs?.length ?? selectedTypes.length

      // Build rich log line: list each job type with assigned machine + scheduled time
      const jobDetails = (order.workshopJobs ?? [])
        .map((j) => {
          const machine = j.assignedMachineName ?? j.assignedMachine?.slice(0, 6) ?? '?'
          const time = j.scheduledStart ? `@${fmtTime(j.scheduledStart)}` : ''
          return `${j.inspectionType} → ${machine}${time ? ` ${time}` : ''}`
        })
        .join(', ')

      addLog('success',
        `[${nowTs()}] ${orderNumber} — ${jobDetails || selectedTypes.join(', ')} | ` +
        `${customer.name} · ${part} (${priority})`
      )

      setStats((s) => ({
        ...s,
        ordersGenerated: s.ordersGenerated + 1,
        jobsQueued: s.jobsQueued + jobCount,
      }))

      // Schedule simulated QR scans
      for (const job of order.workshopJobs ?? []) {
        const machineName = job.assignedMachineName ?? job.inspectionType
        const startAt = job.scheduledStart
          ? new Date(job.scheduledStart).getTime() + Math.random() * 300_000
          : Date.now() + 5_000 + Math.random() * 10_000
        const startDelay = Math.min(Math.max(0, startAt - Date.now()), 30_000)
        const endDelay = startDelay + Math.min((job.durationMinutes ?? 60) * 60_000, 60_000)

        const timeRange = job.scheduledStart
          ? `${fmtTime(job.scheduledStart)}–${fmtTime(job.scheduledEnd)}`
          : ''

        const startTimer = setTimeout(async () => {
          await workshopApi.scan({
            jobId: job.id,
            scanType: 'start',
            scannerId: 'SIM-SCANNER',
            scannedAt: new Date().toISOString(),
          }).then(() => {
            addLog('scan', `[${nowTs()}] START: ${orderNumber} · ${job.inspectionType} → ${machineName}${timeRange ? ` (${timeRange})` : ''}`)
          }).catch(() => {/* ignore */})
        }, startDelay)

        const endTimer = setTimeout(async () => {
          await workshopApi.scan({
            jobId: job.id,
            scanType: 'end',
            scannerId: 'SIM-SCANNER',
            scannedAt: new Date().toISOString(),
          }).then(() => {
            addLog('scan', `[${nowTs()}] END: ${orderNumber} · ${job.inspectionType} → completed`)
            setStats((s) => ({ ...s, jobsCompleted: s.jobsCompleted + 1 }))
          }).catch(() => {/* ignore */})
        }, endDelay)

        scanTimersRef.current.push(startTimer, endTimer)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `[${nowTs()}] Failed to create order: ${msg}`)
    }
  }, [stop])

  function start() {
    setRunning(true)
    setStats({ ordersGenerated: 0, jobsQueued: 0, jobsCompleted: 0 })
    addLog('info', `Simulation started — ${durationMin}min duration, order every ${arrivalRateSec}s`)
    stopTimeRef.current = Date.now() + durationMin * 60_000
    tick()
    intervalRef.current = setInterval(tick, arrivalRateSec * 1000)
  }

  function clearLogs() {
    setLogs([])
  }

  async function clearSimData() {
    stop()  // Stop running sim first so new orders don't arrive during clear
    await workshopApi.clearSimulation()
    setStats({ ordersGenerated: 0, jobsQueued: 0, jobsCompleted: 0 })
    setLogs([])  // Clear log so UI starts fresh
  }

  function toggleInspType(type: InspectionType) {
    setActiveInspTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const value: SimulationContextValue = {
    running, stats, logs, customers,
    durationMin, arrivalRateSec, multiInspectPct, activeInspTypes,
    start, stop, clearSimData, clearLogs,
    setDurationMin, setArrivalRateSec, setMultiInspectPct, toggleInspType,
  }

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  )
}

export { INSPECTION_TYPES }
