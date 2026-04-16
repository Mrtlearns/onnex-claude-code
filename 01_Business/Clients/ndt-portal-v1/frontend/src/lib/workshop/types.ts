export type InspectionType = 'RT' | 'UT' | 'ET' | 'MT' | 'PT' | 'VT'
export type JobStatus = 'unscheduled' | 'scheduled' | 'in_progress' | 'completed'
export type OrderStatus = 'incoming' | 'in_progress' | 'completed' | 'on_hold'
export type Priority = 'high' | 'medium' | 'low'
export type SchedulingMode = 'auto' | 'manual'
export type Role = 'floor_manager' | `${Lowercase<InspectionType>}_inspector`
export type WorkDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface WorkshopMachine {
  id: string
  name: string
  type: InspectionType
  inspectorName: string | null
  displayOrder: number
  isActive: boolean
  offlineWindows: MachineOfflineWindow[]
}

export interface MachineOfflineWindow {
  id: string
  machineId: string
  startAt: string   // ISO timestamp
  endAt: string     // ISO timestamp
  reason: string | null
}

export interface WorkshopJob {
  id: string
  orderId: string
  inspectionType: InspectionType
  sequenceIndex: number
  status: JobStatus
  scheduledStart: string | null
  scheduledEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  durationMinutes: number
  inspectorName: string | null
  schedulingMode: SchedulingMode
  isSimulated: boolean
  notes: string | null
  allowedMachines: string[] | null      // machine UUIDs; null = any machine of same type
  assignedMachine: string | null        // machine UUID actually assigned
  assignedMachineName: string | null    // resolved machine name (from API join)
}

export interface WorkshopOrder {
  id: string
  orderNumber: string
  customer: { name: string } | null
  customerId: string | null
  partNumber: string
  quantity: number
  priority: Priority
  dueDate: string | null
  status: OrderStatus
  isSimulated: boolean
  notes: string | null
  workshopJobs: WorkshopJob[]
}

export interface BusinessHours {
  start: string    // "08:00"
  end: string      // "17:00"
  timezone: string
}

export interface WorkshopSettings {
  businessHours: BusinessHours
  inspectionTypes: InspectionType[]
  inspectionDurationsDefault: Record<InspectionType, number>
  machineCounts: Record<InspectionType, number>  // legacy — still returned by API for compatibility
  workingDays: WorkDay[]
  holidays: string[]       // YYYY-MM-DD strings
  bufferMinutes: number    // 0, 15, 30, 45, 60
}

export interface ScanWebhookPayload {
  jobId: string
  scanType: 'start' | 'end'
  scannerId: string
  scannedAt: string
}

export interface CreateOrderPayload {
  orderNumber: string
  customerId: string | null
  partNumber: string
  quantity: number
  priority: Priority
  dueDate: string | null
  inspectionTypes: InspectionType[]
  notes: string | null
  isSimulated: boolean
  allowedMachines?: Record<string, string[]>   // { 'RT': [machineId1], 'UT': [machineId2] }
}

export interface ScheduleJobPayload {
  scheduledStart: string
  scheduledEnd: string
  inspectorName: string | null
  assignedMachineId?: string | null
}
