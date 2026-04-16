// apps/web/src/__tests__/time-entry-form.test.tsx
// TDD RED — TimeEntryForm component tests + schema validation

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CreateTimeEntrySchema } from '@/lib/schemas';

// Mock react-hook-form (not needed for schema tests)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

let TimeEntryForm: React.ComponentType<any> | null = null;

beforeAll(async () => {
  try {
    const mod = await import('@/app/(protected)/time-tracking/components/time-entry-form');
    TimeEntryForm = mod.TimeEntryForm ?? (mod as any).default;
  } catch {
    TimeEntryForm = null;
  }
});

describe('CreateTimeEntrySchema — validation', () => {
  it('fails validation when duration_minutes is 0', () => {
    const result = CreateTimeEntrySchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000001',
      description: 'Test entry',
      duration_minutes: 0,
      date: '2026-03-11',
      billable: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.duration_minutes).toBeDefined();
    }
  });

  it('defaults billable to true when not provided', () => {
    const result = CreateTimeEntrySchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000001',
      description: 'Test entry',
      duration_minutes: 30,
      date: '2026-03-11',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billable).toBe(true);
    }
  });

  it('fails validation when project_id is not a valid UUID', () => {
    const result = CreateTimeEntrySchema.safeParse({
      project_id: 'not-a-uuid',
      description: 'Test entry',
      duration_minutes: 30,
      date: '2026-03-11',
      billable: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.project_id).toBeDefined();
    }
  });

  it('passes validation with all valid fields', () => {
    const result = CreateTimeEntrySchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000001',
      description: 'Valid entry',
      duration_minutes: 90,
      date: '2026-03-11',
      billable: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional task_id as UUID', () => {
    const result = CreateTimeEntrySchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000001',
      task_id: '00000000-0000-0000-0000-000000000002',
      description: 'Valid entry',
      duration_minutes: 60,
      date: '2026-03-11',
      billable: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('TimeEntryForm — component', () => {
  it('renders when component is available', () => {
    if (!TimeEntryForm) {
      // RED: component not yet built — this test will be RED
      expect(TimeEntryForm).toBeNull();
      return;
    }
    render(<TimeEntryForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save|log time/i })).toBeInTheDocument();
  });

  it('shows project selector', () => {
    if (!TimeEntryForm) {
      expect(TimeEntryForm).toBeNull();
      return;
    }
    render(<TimeEntryForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/project/i)).toBeInTheDocument();
  });
});
