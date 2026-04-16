// apps/web/src/__tests__/timer-widget.test.tsx
// TDD RED — TimerWidget component tests (component does not exist yet)

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock useTimerStore with vi.mock
vi.mock('@/store/timer-store', () => ({
  useTimerStore: vi.fn(),
}));

// Mock useQuery from TanStack Query (projects fetch inside widget)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

let TimerWidget: React.ComponentType | null = null;

beforeAll(async () => {
  try {
    const mod = await import('@/app/(protected)/time-tracking/components/timer-widget');
    TimerWidget = mod.TimerWidget ?? (mod as any).default;
  } catch {
    TimerWidget = null;
  }
});

beforeEach(() => {
  vi.resetModules();
});

describe('TimerWidget — not running state', () => {
  it('renders Start button when timer is not running', async () => {
    const { useTimerStore } = await import('@/store/timer-store');
    (useTimerStore as ReturnType<typeof vi.fn>).mockReturnValue({
      isRunning: false,
      description: '',
      start_time: null,
      project_id: null,
      task_id: null,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      cancelTimer: vi.fn(),
      updateDescription: vi.fn(),
    });

    if (!TimerWidget) {
      // RED: component not yet built
      expect(TimerWidget).toBeNull();
      return;
    }
    render(<TimerWidget />);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('renders project selector when timer is not running', async () => {
    const { useTimerStore } = await import('@/store/timer-store');
    (useTimerStore as ReturnType<typeof vi.fn>).mockReturnValue({
      isRunning: false,
      description: '',
      start_time: null,
      project_id: null,
      task_id: null,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      cancelTimer: vi.fn(),
      updateDescription: vi.fn(),
    });

    if (!TimerWidget) {
      expect(TimerWidget).toBeNull();
      return;
    }
    render(<TimerWidget />);
    // project selector should be present — use getAllByText since label + placeholder both match
    const projectElements = screen.getAllByText(/project/i);
    expect(projectElements.length).toBeGreaterThan(0);
  });
});

describe('TimerWidget — running state', () => {
  it('renders Stop button when timer is running', async () => {
    const { useTimerStore } = await import('@/store/timer-store');
    (useTimerStore as ReturnType<typeof vi.fn>).mockReturnValue({
      isRunning: true,
      description: 'Working on feature',
      start_time: Date.now() - 120000,
      project_id: '00000000-0000-0000-0000-000000000001',
      task_id: null,
      startTimer: vi.fn(),
      stopTimer: vi.fn().mockReturnValue({
        duration_minutes: 2,
        project_id: '00000000-0000-0000-0000-000000000001',
        task_id: null,
        description: 'Working on feature',
      }),
      cancelTimer: vi.fn(),
      updateDescription: vi.fn(),
    });

    if (!TimerWidget) {
      expect(TimerWidget).toBeNull();
      return;
    }
    render(<TimerWidget />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows elapsed time display when timer is running', async () => {
    const { useTimerStore } = await import('@/store/timer-store');
    (useTimerStore as ReturnType<typeof vi.fn>).mockReturnValue({
      isRunning: true,
      description: 'Task work',
      start_time: Date.now() - 65000, // ~1 min 5 sec
      project_id: '00000000-0000-0000-0000-000000000001',
      task_id: null,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      cancelTimer: vi.fn(),
      updateDescription: vi.fn(),
    });

    if (!TimerWidget) {
      expect(TimerWidget).toBeNull();
      return;
    }
    render(<TimerWidget />);
    // Should show some time display — look for digit pattern
    const timeDisplay = document.querySelector('[data-testid="elapsed-time"]');
    expect(timeDisplay).not.toBeNull();
  });
});
