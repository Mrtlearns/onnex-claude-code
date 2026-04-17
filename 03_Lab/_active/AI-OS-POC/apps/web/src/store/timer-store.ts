// apps/web/src/store/timer-store.ts
// Zustand store for active timer — persisted to localStorage via 'aios-timer' key

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  isRunning: boolean;
  start_time: number | null;   // Date.now() value when timer started
  project_id: string | null;
  task_id: string | null;
  description: string;
  // actions
  startTimer: (project_id: string, task_id: string | null, description: string) => void;
  stopTimer: () => { duration_minutes: number; project_id: string; task_id: string | null; description: string } | null;
  cancelTimer: () => void;
  updateDescription: (description: string) => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      start_time: null,
      project_id: null,
      task_id: null,
      description: '',
      startTimer: (project_id, task_id, description) =>
        set({ isRunning: true, start_time: Date.now(), project_id, task_id, description }),
      stopTimer: () => {
        const { start_time, project_id, task_id, description } = get();
        if (!start_time || !project_id) return null;
        const duration_minutes = Math.max(1, Math.round((Date.now() - start_time) / 60000));
        set({ isRunning: false, start_time: null, project_id: null, task_id: null, description: '' });
        return { duration_minutes, project_id, task_id, description };
      },
      cancelTimer: () =>
        set({ isRunning: false, start_time: null, project_id: null, task_id: null, description: '' }),
      updateDescription: (description) => set({ description }),
    }),
    { name: 'aios-timer' }  // localStorage key
  )
);
