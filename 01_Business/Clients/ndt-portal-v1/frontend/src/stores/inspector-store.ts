import { create } from 'zustand';
import { getAuthHeaders } from '../lib/api';
import type {
  PartClassification,
  RTAnalysis,
  InspectionZone,
  SeverityLevel,
  AnalysisJob,
} from '../lib/rt/inspector-types';

// ── Job history ───────────────────────────────────────────────────────────────

export interface JobHistoryEntry {
  jobId:     string;
  partId:    string;
  partType:  string;
  timestamp: string;
}

const HISTORY_KEY = 'ndt_rt_job_history';
const MAX_HISTORY = 20;

export function loadJobHistory(): JobHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as JobHistoryEntry[]; }
  catch { return []; }
}

function saveJobHistory(entry: JobHistoryEntry) {
  try {
    const list = loadJobHistory().filter((e) => e.jobId !== entry.jobId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...list].slice(0, MAX_HISTORY)));
  } catch { /* storage quota — non-fatal */ }
}

const POLL_INTERVAL_MS = 800;
const API_BASE = '/api';

export interface InspectorState {
  // Pipeline data
  jobId:          string | null;
  classification: PartClassification | null;
  analysis:       RTAnalysis | null;
  loading:        boolean;
  error:          string | null;
  stage:          string | null;
  lowConfidence:  boolean;
  complianceResult: {
    classification: string;
    score: number;
    routing: string;
    hits: Array<{ pattern: string; category: string; weight: number; match: string }>;
  } | null;

  // UI toggles (all ON by default; wireframe OFF)
  showCritical:   boolean;
  showHigh:       boolean;
  showMedium:     boolean;
  showLow:        boolean;
  showWireframe:  boolean;
  showLabels:     boolean;

  // Overlay thickness multiplier (1.0 = default)
  overlayThickness: number;
  setOverlayThickness: (v: number) => void;

  // STL viewer modal
  showStlViewer:  boolean;
  toggleStlViewer: () => void;

  // Hover state
  hoveredZone:    InspectionZone | null;
  cursorPosition: { x: number; y: number } | null;

  // Theme
  theme: 'dark' | 'light';

  // Machine envelope overlay
  selectedMachineId: string | null;
  machineProfiles:   MachineProfile[];

  // Export fns (registered by SceneCanvas on mount)
  exportPng:         (() => void) | null;
  exportStl:         (() => void) | null;
  registerExportPng: (fn: () => void) => void;
  registerExportStl: (fn: () => void) => void;

  // Actions
  toggleSeverity:   (level: SeverityLevel) => void;
  toggleWireframe:  () => void;
  toggleLabels:     () => void;
  toggleTheme:      () => void;
  setHoveredZone:   (zone: InspectionZone | null, cursor?: { x: number; y: number }) => void;
  loadAnalysis:     (file: File) => Promise<void>;
  loadJob:          (jobId: string) => Promise<void>;
  reset:            () => void;
  selectMachine:    (id: string | null) => void;
  loadMachines:     () => Promise<void>;
}

export interface MachineProfile {
  machine_id: string;
  nickname:   string;
  spec: {
    inspection_envelope: {
      max_part_diameter_mm: number;
      max_part_height_mm:   number;
    };
  };
}

// Internal: poll job until terminal state
let pollingTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export const useInspectorStore = create<InspectorState>((set, get) => ({
  // Initial state
  jobId:            null,
  classification:   null,
  analysis:         null,
  loading:          false,
  error:            null,
  stage:            null,
  lowConfidence:    false,
  complianceResult: null,

  showCritical:   true,
  showHigh:       true,
  showMedium:     true,
  showLow:        true,
  showWireframe:  false,
  showLabels:     true,

  overlayThickness: 1.0,
  showStlViewer:    false,

  hoveredZone:    null,
  cursorPosition: null,

  theme: 'dark',

  selectedMachineId: null,
  machineProfiles:   [],

  exportPng: null,
  exportStl: null,

  // ── Toggles ─────────────────────────────────────────────────────────────────

  registerExportPng: (fn) => set({ exportPng: fn }),
  registerExportStl: (fn) => set({ exportStl: fn }),

  setOverlayThickness: (v) => set({ overlayThickness: v }),
  toggleStlViewer: () => set((s) => ({ showStlViewer: !s.showStlViewer })),

  toggleSeverity: (level) => {
    const key = `show${level.charAt(0)}${level.slice(1).toLowerCase()}` as keyof InspectorState;
    set((s) => ({ [key]: !s[key] } as Partial<InspectorState>));
  },

  toggleWireframe: () => set((s) => ({ showWireframe: !s.showWireframe })),
  toggleLabels:    () => set((s) => ({ showLabels:    !s.showLabels })),
  toggleTheme:     () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  setHoveredZone: (zone, cursor) =>
    set({ hoveredZone: zone, cursorPosition: cursor ?? null }),

  // ── Load from file ───────────────────────────────────────────────────────────

  loadAnalysis: async (file: File) => {
    stopPolling();
    set({ loading: true, error: null, stage: 'Uploading', classification: null, analysis: null });

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const resp = await fetch(`${API_BASE}/rt/analyze`, {
        method:  'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({
          file:     base64,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error ?? `Server error ${resp.status}`);
      }

      const { jobId } = await resp.json() as { jobId: string };
      set({ jobId, stage: 'Queued' });

      // Start polling
      pollingTimer = setInterval(async () => {
        try {
          await get().loadJob(jobId);
          const { analysis, error } = get();
          if (analysis || error) stopPolling();
        } catch (e) {
          console.error('[inspector-store] poll error:', e);
        }
      }, POLL_INTERVAL_MS);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },

  // ── Poll job status ──────────────────────────────────────────────────────────

  loadJob: async (jobId: string) => {
    const resp = await fetch(`${API_BASE}/rt/analyze/${jobId}`, { headers: getAuthHeaders() });
    if (!resp.ok) {
      if (resp.status === 404) {
        set({ loading: false, error: 'Analysis job not found' });
      }
      return;
    }

    const job = await resp.json() as AnalysisJob;

    const complianceResult = job.complianceClass
      ? {
          classification: job.complianceClass,
          score:          job.complianceScore   ?? 0,
          routing:        job.complianceRouting ?? '',
          hits:           job.complianceHits    ?? [],
        }
      : null;

    if (job.status === 'complete' && job.classification && job.analysis) {
      set({
        loading:          false,
        stage:            'Complete',
        classification:   job.classification,
        analysis:         job.analysis,
        lowConfidence:    job.lowConfidence ?? false,
        error:            null,
        complianceResult,
      });
      saveJobHistory({
        jobId,
        partId:    job.classification.part_id,
        partType:  job.classification.part_type,
        timestamp: new Date().toISOString(),
      });
    } else if (job.status === 'failed') {
      set({
        loading:          false,
        stage:            null,
        error:            job.error ?? 'Analysis failed',
        complianceResult,
      });
    } else {
      // Still in progress
      set({ stage: job.stage ?? job.status, complianceResult });
    }
  },

  // ── Machine envelope ─────────────────────────────────────────────────────────

  selectMachine: (id) => set({ selectedMachineId: id }),

  loadMachines: async () => {
    if (get().machineProfiles.length > 0) return; // already loaded
    try {
      const resp = await fetch(`${API_BASE}/rt/machines`, { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const rows = await resp.json() as MachineProfile[];
      set({ machineProfiles: rows });
    } catch {
      // non-fatal — machine panel just won't populate
    }
  },

  // ── Reset ────────────────────────────────────────────────────────────────────

  reset: () => {
    stopPolling();
    set({
      jobId:            null,
      classification:   null,
      analysis:         null,
      loading:          false,
      error:            null,
      stage:            null,
      lowConfidence:    false,
      complianceResult: null,
      hoveredZone:      null,
      cursorPosition:   null,
    });
  },
}));
