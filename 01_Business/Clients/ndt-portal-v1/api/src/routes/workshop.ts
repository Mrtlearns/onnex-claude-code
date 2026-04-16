import { Router, Request, Response } from 'express';
import { query, queryOne, pool } from '../db';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// ── SSE client registry ──────────────────────────────────────
const sseClients = new Set<Response>();

function broadcastUpdate(): void {
  if (sseClients.size === 0) return;
  fetchTodayOrders()
    .then((orders) => {
      const data = JSON.stringify(orders);
      for (const client of sseClients) {
        try {
          client.write(`event: update\ndata: ${data}\n\n`);
        } catch {
          sseClients.delete(client);
        }
      }
    })
    .catch((err) => console.error('[workshop sse] broadcast error', err));
}

// ── Today's orders snapshot query ────────────────────────────
async function fetchTodayOrders() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const orders = await query<{
    id: string; order_number: string; customer_id: string | null;
    customer_name: string | null; part_number: string; quantity: number;
    priority: string; due_date: string | null; status: string;
    is_simulated: boolean; notes: string | null; created_at: string;
  }>(`
    SELECT
      o.id, o.order_number, o.customer_id,
      c.name AS customer_name,
      o.part_number, o.quantity, o.priority, o.due_date,
      o.status, o.is_simulated, o.notes, o.created_at
    FROM workshop.orders o
    LEFT JOIN ut.customers c ON c.id = o.customer_id
    WHERE o.id IN (
      SELECT DISTINCT order_id FROM workshop.jobs
      WHERE (scheduled_start >= $1 AND scheduled_start <= $2)
         OR (scheduled_start IS NULL AND created_at >= $1)
    ) OR o.created_at >= $1
    ORDER BY o.created_at DESC
  `, [todayStart.toISOString(), todayEnd.toISOString()]);

  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const jobs = await query<{
    id: string; order_id: string; inspection_type: string;
    sequence_index: number; status: string;
    scheduled_start: string | null; scheduled_end: string | null;
    actual_start: string | null; actual_end: string | null;
    duration_minutes: number; inspector_name: string | null;
    scheduling_mode: string; is_simulated: boolean; notes: string | null;
    allowed_machines: string[] | null; assigned_machine: string | null;
    assigned_machine_name: string | null;
  }>(`
    SELECT
      j.id, j.order_id, j.inspection_type, j.sequence_index, j.status,
      j.scheduled_start, j.scheduled_end, j.actual_start, j.actual_end,
      j.duration_minutes, j.inspector_name, j.scheduling_mode, j.is_simulated,
      j.notes,
      j.allowed_machines, j.assigned_machine,
      m.name AS assigned_machine_name
    FROM workshop.jobs j
    LEFT JOIN workshop.machines m ON m.id = j.assigned_machine
    WHERE j.order_id = ANY($1::uuid[])
    ORDER BY j.sequence_index ASC
  `, [orderIds]);

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer_id,
    customer: o.customer_name ? { name: o.customer_name } : null,
    partNumber: o.part_number,
    quantity: o.quantity,
    priority: o.priority,
    dueDate: o.due_date,
    status: o.status,
    isSimulated: o.is_simulated,
    notes: o.notes,
    workshopJobs: jobs
      .filter((j) => j.order_id === o.id)
      .map((j) => ({
        id: j.id,
        orderId: j.order_id,
        inspectionType: j.inspection_type,
        sequenceIndex: j.sequence_index,
        status: j.status,
        scheduledStart: j.scheduled_start,
        scheduledEnd: j.scheduled_end,
        actualStart: j.actual_start,
        actualEnd: j.actual_end,
        durationMinutes: j.duration_minutes,
        inspectorName: j.inspector_name,
        schedulingMode: j.scheduling_mode,
        isSimulated: j.is_simulated,
        notes: j.notes,
        allowedMachines: j.allowed_machines,
        assignedMachine: j.assigned_machine,
        assignedMachineName: j.assigned_machine_name,
      })),
  }));
}

// ── Scheduling helpers ────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isWorkingDay(dateStr: string, workingDays: string[], holidays: string[]): boolean {
  if (holidays.includes(dateStr)) return false;
  const d = new Date(`${dateStr}T12:00:00Z`);
  return workingDays.includes(DAY_NAMES[d.getUTCDay()]);
}

/** Convert a local date+time string to a UTC Date, accounting for the configured timezone. */
function localTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const inTz = new Date(naive.toLocaleString('en-US', { timeZone }));
  const offset = naive.getTime() - inTz.getTime();
  return new Date(naive.getTime() + offset);
}

/** Advance dateStr by one calendar day, returning YYYY-MM-DD. */
function nextDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Find the next working day at or after dateStr (max 14 day search). */
function nextWorkingDay(dateStr: string, workingDays: string[], holidays: string[]): string {
  let current = dateStr;
  for (let i = 0; i < 14; i++) {
    if (isWorkingDay(current, workingDays, holidays)) return current;
    current = nextDateStr(current);
  }
  return dateStr; // fallback — return original if no working day found
}

// ── scheduleNextAvailable ────────────────────────────────────
// Machine-aware scheduler. Finds the earliest slot on an allowed machine
// that satisfies: working day, no machine offline window, no overlapping job
// (including buffer gap), within business hours.
async function scheduleNextAvailable(jobId: string, client = pool): Promise<void> {
  const cl = await client.connect();
  try {
    const job = await cl.query(
      `SELECT id, order_id, inspection_type, duration_minutes, scheduling_mode, allowed_machines
       FROM workshop.jobs WHERE id = $1`,
      [jobId]
    );
    if (!job.rows.length) return;
    const { inspection_type, duration_minutes, scheduling_mode, allowed_machines } = job.rows[0] as {
      inspection_type: string;
      duration_minutes: number;
      scheduling_mode: string;
      allowed_machines: string[] | null;
    };

    if (scheduling_mode === 'manual') return;

    // Advisory lock per inspection_type — serialises scheduling within a type
    const lockKey = inspection_type
      .split('')
      .reduce((acc: number, c: string) => (acc * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);

    await cl.query('BEGIN');
    try {
      await cl.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // Read all settings in one pass
      const settingsRows = await cl.query(
        `SELECT key, value FROM workshop.settings
         WHERE key IN ('business_hours', 'working_days', 'holidays', 'buffer_minutes')`
      );
      const raw: Record<string, unknown> = {};
      for (const row of settingsRows.rows) raw[row.key] = row.value;

      const bh = (raw['business_hours'] as { start: string; end: string; timezone?: string })
        ?? { start: '08:00', end: '17:00', timezone: 'America/Chicago' };
      const tz = bh.timezone ?? 'America/Chicago';
      const workingDays = (raw['working_days'] as string[]) ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const holidays   = (raw['holidays'] as string[]) ?? [];
      const bufferMs   = ((raw['buffer_minutes'] as number) ?? 0) * 60 * 1000;

      // "Today" in the configured timezone
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

      // Determine which machines to use for this job
      let machineIds: string[];
      if (allowed_machines && allowed_machines.length > 0) {
        // Filter to active machines within the allowed list
        const res = await cl.query(
          `SELECT id FROM workshop.machines WHERE id = ANY($1::uuid[]) AND is_active = TRUE AND type = $2`,
          [allowed_machines, inspection_type]
        );
        machineIds = res.rows.map((r: { id: string }) => r.id);
      } else {
        // Any active machine for this inspection type
        const res = await cl.query(
          `SELECT id FROM workshop.machines WHERE type = $1 AND is_active = TRUE ORDER BY display_order ASC`,
          [inspection_type]
        );
        machineIds = res.rows.map((r: { id: string }) => r.id);
      }

      if (machineIds.length === 0) {
        // No machines configured — fall back to legacy count-based scheduling
        await cl.query('ROLLBACK');
        return;
      }

      const durationMs = duration_minutes * 60 * 1000;

      // Find the first working day at or after today
      let searchDateStr = nextWorkingDay(todayStr, workingDays, holidays);
      let businessStart = localTimeToUtc(searchDateStr, bh.start, tz);
      let businessEnd   = localTimeToUtc(searchDateStr, bh.end, tz);

      // Start candidate at max(now, businessStart)
      let candidate = new Date(Math.max(Date.now(), businessStart.getTime()));

      let assignedMachineId: string | null = null;
      let assignedStart: Date | null = null;
      let assignedEnd: Date | null = null;

      // Sweep forward up to 30 working days
      for (let dayIter = 0; dayIter < 30 && !assignedMachineId; dayIter++) {
        // Fetch all scheduled jobs on any candidate machine for this search day (inside lock)
        const scheduledRows = await cl.query(`
          SELECT j.assigned_machine, j.scheduled_start, j.scheduled_end
          FROM workshop.jobs j
          WHERE j.assigned_machine = ANY($1::uuid[])
            AND j.status IN ('scheduled', 'in_progress')
            AND (j.scheduled_start AT TIME ZONE $2)::date = $3::date
            AND j.id != $4
          ORDER BY j.scheduled_start ASC
        `, [machineIds, tz, searchDateStr, jobId]);

        // Fetch offline windows for candidate machines on this day
        const offlineRows = await cl.query(`
          SELECT machine_id, start_at, end_at
          FROM workshop.machine_offline_windows
          WHERE machine_id = ANY($1::uuid[])
            AND start_at < $2
            AND end_at > $3
        `, [machineIds, businessEnd.toISOString(), businessStart.toISOString()]);

        // Build per-machine occupancy maps
        const machineJobs: Map<string, Array<{ s: number; e: number }>> = new Map();
        const machineOffline: Map<string, Array<{ s: number; e: number }>> = new Map();
        for (const mid of machineIds) { machineJobs.set(mid, []); machineOffline.set(mid, []); }
        for (const row of scheduledRows.rows) {
          machineJobs.get(row.assigned_machine)?.push({
            s: new Date(row.scheduled_start).getTime(),
            e: new Date(row.scheduled_end).getTime(),
          });
        }
        for (const row of offlineRows.rows) {
          machineOffline.get(row.machine_id)?.push({
            s: new Date(row.start_at).getTime(),
            e: new Date(row.end_at).getTime(),
          });
        }

        // Sweep candidate times within this day's business hours
        let slotFound = false;
        for (let slotIter = 0; slotIter < 200 && !slotFound; slotIter++) {
          // Clamp candidate to business start of this day
          if (candidate.getTime() < businessStart.getTime()) {
            candidate = new Date(businessStart.getTime());
          }
          if (candidate.getTime() + durationMs > businessEnd.getTime()) break; // No more room today

          const candEnd = candidate.getTime() + durationMs;
          let earliestBlockEnd = Infinity;

          // Check each machine for availability at [candidate, candEnd)
          for (const mid of machineIds) {
            const jobs    = machineJobs.get(mid) ?? [];
            const offline = machineOffline.get(mid) ?? [];

            // A blocking event: job overlaps [candidate - buffer, candEnd) i.e.
            // event.end + bufferMs > candidate AND event.start < candEnd
            const blockingJobs = jobs.filter(
              (j) => j.e + bufferMs > candidate.getTime() && j.s < candEnd
            );
            const blockingOffline = offline.filter(
              (w) => w.e > candidate.getTime() && w.s < candEnd
            );

            if (blockingJobs.length === 0 && blockingOffline.length === 0) {
              // This machine is free — assign it
              assignedMachineId = mid;
              assignedStart     = new Date(candidate.getTime());
              assignedEnd       = new Date(candEnd);
              slotFound = true;
              break;
            }

            // Track earliest end of blocking events (for advancing candidate)
            for (const j of blockingJobs) {
              // The earliest we can START after this job (accounting for buffer)
              earliestBlockEnd = Math.min(earliestBlockEnd, j.e + bufferMs);
            }
            for (const w of blockingOffline) {
              earliestBlockEnd = Math.min(earliestBlockEnd, w.e);
            }
          }

          if (!slotFound) {
            if (earliestBlockEnd === Infinity || earliestBlockEnd <= candidate.getTime()) break;
            candidate = new Date(earliestBlockEnd); // Advance to earliest unblock time
          }
        }

        if (!assignedMachineId) {
          // No slot today — advance to next working day
          searchDateStr = nextWorkingDay(nextDateStr(searchDateStr), workingDays, holidays);
          businessStart = localTimeToUtc(searchDateStr, bh.start, tz);
          businessEnd   = localTimeToUtc(searchDateStr, bh.end, tz);
          candidate     = new Date(businessStart.getTime());
        }
      }

      if (!assignedMachineId || !assignedStart || !assignedEnd) {
        // Could not find a slot in 30 working days — leave unscheduled
        await cl.query('ROLLBACK');
        return;
      }

      // Lookup default inspector for assigned machine
      const machineRow = await cl.query(
        `SELECT inspector_name FROM workshop.machines WHERE id = $1`,
        [assignedMachineId]
      );
      const defaultInspector: string | null = machineRow.rows[0]?.inspector_name ?? null;

      await cl.query(`
        UPDATE workshop.jobs
        SET scheduled_start = $1, scheduled_end = $2, status = 'scheduled',
            scheduling_mode = 'auto', assigned_machine = $3,
            inspector_name = COALESCE(inspector_name, $4),
            updated_at = now()
        WHERE id = $5 AND scheduling_mode != 'manual'
      `, [assignedStart.toISOString(), assignedEnd.toISOString(),
          assignedMachineId, defaultInspector, jobId]);

      await cl.query('COMMIT');
    } catch (e) {
      await cl.query('ROLLBACK');
      throw e;
    }
  } finally {
    cl.release();
  }
}

// ── SSE endpoint ─────────────────────────────────────────────
router.get('/sse', requirePermission('WORKSHOP_VIEW'), (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);

  fetchTodayOrders()
    .then((orders) => {
      res.write(`event: init\ndata: ${JSON.stringify(orders)}\n\n`);
    })
    .catch((err) => console.error('[workshop sse] init error', err));

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ── GET /workshop/today ──────────────────────────────────────
router.get('/today', requirePermission('WORKSHOP_VIEW'), async (_req: Request, res: Response) => {
  try {
    const orders = await fetchTodayOrders();
    return res.json(orders);
  } catch (e) {
    console.error('GET /workshop/today error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /workshop/settings ───────────────────────────────────
router.get('/settings', requirePermission('WORKSHOP_VIEW'), async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ key: string; value: unknown }>(
      `SELECT key, value FROM workshop.settings`
    );
    const raw: Record<string, unknown> = {};
    for (const row of rows) raw[row.key] = row.value;

    return res.json({
      businessHours: raw['business_hours'] ?? { start: '08:00', end: '17:00', timezone: 'America/Los_Angeles' },
      inspectionTypes: raw['inspection_types'] ?? ['RT', 'UT', 'ET', 'MT', 'PT', 'VT'],
      inspectionDurationsDefault: raw['inspection_durations_default'] ?? { RT: 60, UT: 60, ET: 60, MT: 60, PT: 60, VT: 60 },
      machineCounts: raw['machine_counts'] ?? { RT: 2, UT: 1, ET: 1, MT: 1, PT: 1, VT: 1 },
      workingDays: raw['working_days'] ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      holidays: raw['holidays'] ?? [],
      bufferMinutes: raw['buffer_minutes'] ?? 0,
    });
  } catch (e) {
    console.error('GET /workshop/settings error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /workshop/settings/:key ────────────────────────────
router.patch('/settings/:key', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body as { value: unknown };
    await query(
      `INSERT INTO workshop.settings (key, value) VALUES ($2, $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [JSON.stringify(value), key]
    );
    broadcastUpdate();
    return res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /workshop/settings error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /workshop/machines ───────────────────────────────────
// Auto-syncs RT machines from rt.machine_catalog (source of truth) before returning.
router.get('/machines', requirePermission('WORKSHOP_VIEW'), async (_req: Request, res: Response) => {
  try {
    // Sync RT machines from rt.machine_catalog → workshop.machines
    // This keeps Workshop in step with Integration Settings → RT tab.

    // Clear jobs pointing to orphaned RT rows (no rt_catalog_id link) before deleting them
    await query(
      `UPDATE workshop.jobs SET assigned_machine = NULL
       WHERE assigned_machine IN (
         SELECT id FROM workshop.machines WHERE type = 'RT' AND rt_catalog_id IS NULL
       )`
    );
    // Remove orphaned RT rows left over from name-mismatch during migration 030
    await query(
      `DELETE FROM workshop.machines WHERE type = 'RT' AND rt_catalog_id IS NULL`
    );

    await query(
      `INSERT INTO workshop.machines (name, type, is_active, rt_catalog_id, display_order)
       SELECT
         mc.nickname,
         'RT',
         mc.is_active,
         mc.machine_id,
         ROW_NUMBER() OVER (ORDER BY mc.machine_id) - 1
       FROM rt.machine_catalog mc
       ON CONFLICT (rt_catalog_id) WHERE rt_catalog_id IS NOT NULL
       DO UPDATE SET
         name      = EXCLUDED.name,
         is_active = EXCLUDED.is_active`
    );

    const machines = await query<{
      id: string; name: string; type: string; inspector_name: string | null;
      display_order: number; is_active: boolean;
    }>(
      `SELECT id, name, type, inspector_name, display_order, is_active
       FROM workshop.machines ORDER BY type ASC, display_order ASC`
    );

    const offlineRows = await query<{
      id: string; machine_id: string; start_at: string; end_at: string; reason: string | null;
    }>(
      `SELECT id, machine_id, start_at, end_at, reason
       FROM workshop.machine_offline_windows
       ORDER BY start_at ASC`
    );

    return res.json(machines.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      inspectorName: m.inspector_name,
      displayOrder: m.display_order,
      isActive: m.is_active,
      offlineWindows: offlineRows
        .filter((w) => w.machine_id === m.id)
        .map((w) => ({
          id: w.id,
          machineId: w.machine_id,
          startAt: w.start_at,
          endAt: w.end_at,
          reason: w.reason,
        })),
    })));
  } catch (e) {
    console.error('GET /workshop/machines error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/machines ──────────────────────────────────
router.post('/machines', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { name, type, inspectorName, displayOrder } = req.body as {
      name: string; type: string; inspectorName?: string | null; displayOrder?: number;
    };
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const result = await queryOne<{ id: string }>(`
      INSERT INTO workshop.machines (name, type, inspector_name, display_order)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [name, type, inspectorName ?? null, displayOrder ?? 0]);

    if (!result) throw new Error('Insert failed');
    const machine = await queryOne(
      `SELECT id, name, type, inspector_name, display_order, is_active FROM workshop.machines WHERE id = $1`,
      [result.id]
    );
    broadcastUpdate();
    return res.status(201).json(machine);
  } catch (e) {
    console.error('POST /workshop/machines error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /workshop/machines/:id ───────────────────────────────
router.put('/machines/:id', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, inspectorName, displayOrder, isActive } = req.body as {
      name?: string; inspectorName?: string | null; displayOrder?: number; isActive?: boolean;
    };

    await query(`
      UPDATE workshop.machines
      SET name            = COALESCE($1, name),
          inspector_name  = COALESCE($2, inspector_name),
          display_order   = COALESCE($3, display_order),
          is_active       = COALESCE($4, is_active),
          updated_at      = now()
      WHERE id = $5
    `, [name ?? null, inspectorName ?? null, displayOrder ?? null, isActive ?? null, id]);

    const machine = await queryOne(
      `SELECT id, name, type, inspector_name, display_order, is_active FROM workshop.machines WHERE id = $1`,
      [id]
    );
    broadcastUpdate();
    return res.json(machine);
  } catch (e) {
    console.error('PUT /workshop/machines/:id error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /workshop/machines/:id ────────────────────────────
router.delete('/machines/:id', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Soft delete — mark inactive
    await query(
      `UPDATE workshop.machines SET is_active = FALSE, updated_at = now() WHERE id = $1`,
      [id]
    );
    broadcastUpdate();
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /workshop/machines/:id error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/machines/:id/offline ─────────────────────
router.post('/machines/:id/offline', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startAt, endAt, reason } = req.body as {
      startAt: string; endAt: string; reason?: string | null;
    };
    if (!startAt || !endAt) return res.status(400).json({ error: 'startAt and endAt are required' });

    const result = await queryOne<{ id: string }>(`
      INSERT INTO workshop.machine_offline_windows (machine_id, start_at, end_at, reason)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [id, startAt, endAt, reason ?? null]);

    return res.status(201).json(result);
  } catch (e) {
    console.error('POST /workshop/machines/:id/offline error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /workshop/machines/:id/offline/:wid ───────────────
router.delete('/machines/:id/offline/:wid', requirePermission('WORKSHOP_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { id, wid } = req.params;
    await query(
      `DELETE FROM workshop.machine_offline_windows WHERE id = $1 AND machine_id = $2`,
      [wid, id]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /workshop/machines/:id/offline/:wid error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/webhook/scan ──────────────────────────────
router.post('/webhook/scan', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (req: Request, res: Response) => {
  try {
    const { jobId, scanType, scannerId: _scannerId, scannedAt } = req.body as {
      jobId: string; scanType: 'start' | 'end'; scannerId: string; scannedAt: string;
    };

    if (!jobId || !scanType) {
      return res.status(400).json({ error: 'jobId and scanType are required' });
    }

    if (scanType === 'start') {
      await query(`
        UPDATE workshop.jobs
        SET actual_start = $1, status = 'in_progress', updated_at = now()
        WHERE id = $2
      `, [scannedAt ?? new Date().toISOString(), jobId]);
    } else {
      await query(`
        UPDATE workshop.jobs
        SET actual_end = $1, status = 'completed', updated_at = now()
        WHERE id = $2
      `, [scannedAt ?? new Date().toISOString(), jobId]);

      // Auto-schedule remaining unscheduled sibling jobs
      const siblings = await query<{ id: string }>(`
        SELECT j.id FROM workshop.jobs j
        JOIN workshop.jobs src ON src.order_id = j.order_id
        WHERE src.id = $1
          AND j.id != $1
          AND j.status = 'unscheduled'
          AND j.scheduling_mode = 'auto'
        ORDER BY j.sequence_index ASC
      `, [jobId]);

      for (const sib of siblings) {
        await scheduleNextAvailable(sib.id);
      }
    }

    // Update parent order status
    await query(`
      UPDATE workshop.orders o
      SET status = (
        CASE
          WHEN (SELECT COUNT(*) FROM workshop.jobs WHERE order_id = o.id AND status != 'completed') = 0
            THEN 'completed'
          WHEN (SELECT COUNT(*) FROM workshop.jobs WHERE order_id = o.id AND status = 'in_progress') > 0
            THEN 'in_progress'
          ELSE 'incoming'
        END
      ), updated_at = now()
      WHERE o.id = (SELECT order_id FROM workshop.jobs WHERE id = $1)
    `, [jobId]);

    const updatedJob = await queryOne<{ id: string }>(
      `SELECT * FROM workshop.jobs WHERE id = $1`, [jobId]
    );

    broadcastUpdate();
    return res.json(updatedJob);
  } catch (e) {
    console.error('POST /workshop/webhook/scan error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/jobs/:id/schedule ────────────────────────
router.post('/jobs/:id/schedule', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduledStart, scheduledEnd, inspectorName, assignedMachineId } = req.body as {
      scheduledStart: string; scheduledEnd: string;
      inspectorName: string | null; assignedMachineId?: string | null;
    };

    await query(`
      UPDATE workshop.jobs
      SET scheduled_start  = $1, scheduled_end = $2,
          inspector_name   = $3,
          assigned_machine = COALESCE($4::uuid, assigned_machine),
          scheduling_mode  = 'manual', status = 'scheduled', updated_at = now()
      WHERE id = $5
    `, [scheduledStart, scheduledEnd, inspectorName ?? null,
        assignedMachineId ?? null, id]);

    const updatedJob = await queryOne(`SELECT * FROM workshop.jobs WHERE id = $1`, [id]);
    broadcastUpdate();
    return res.json(updatedJob);
  } catch (e) {
    console.error('POST /workshop/jobs/:id/schedule error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/jobs/:id/duration ────────────────────────
router.post('/jobs/:id/duration', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { durationMinutes } = req.body as { durationMinutes: number };

    await query(
      `UPDATE workshop.jobs SET duration_minutes = $1, updated_at = now() WHERE id = $2`,
      [durationMinutes, id]
    );

    await scheduleNextAvailable(id);
    const siblings = await query<{ id: string }>(`
      SELECT j.id FROM workshop.jobs j
      JOIN workshop.jobs src ON src.order_id = j.order_id
      WHERE src.id = $1 AND j.id != $1 AND j.scheduling_mode = 'auto'
      ORDER BY j.sequence_index ASC
    `, [id]);
    for (const sib of siblings) await scheduleNextAvailable(sib.id);

    broadcastUpdate();
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /workshop/jobs/:id/duration error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/jobs/replan ────────────────────────────────
// Bulk reschedule: clears schedule for listed jobs and re-runs auto-scheduler.
router.post('/jobs/replan', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (req: Request, res: Response) => {
  try {
    const { jobIds } = req.body as { jobIds: string[] };
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'jobIds array is required' });
    }

    // Clear existing schedules
    await query(`
      UPDATE workshop.jobs
      SET scheduled_start = NULL, scheduled_end = NULL,
          assigned_machine = NULL, status = 'unscheduled',
          scheduling_mode = 'auto', updated_at = now()
      WHERE id = ANY($1::uuid[]) AND scheduling_mode != 'manual'
    `, [jobIds]);

    // Re-schedule each job
    const failed: string[] = [];
    for (const jid of jobIds) {
      try {
        await scheduleNextAvailable(jid);
      } catch (e) {
        console.error(`[replan] failed to schedule job ${jid}:`, e);
        failed.push(jid);
      }
    }

    broadcastUpdate();
    return res.json({ rescheduled: jobIds.length - failed.length, failed });
  } catch (e) {
    console.error('POST /workshop/jobs/replan error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /workshop/orders ────────────────────────────────────
router.post('/orders', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (req: Request, res: Response) => {
  try {
    const {
      orderNumber, customerId, partNumber, quantity, priority,
      dueDate, inspectionTypes, notes, isSimulated, allowedMachines,
    } = req.body as {
      orderNumber: string; customerId: string | null; partNumber: string;
      quantity: number; priority: string; dueDate: string | null;
      inspectionTypes: string[]; notes: string | null; isSimulated: boolean;
      allowedMachines?: Record<string, string[]>;  // { 'RT': [machineId1, machineId2] }
    };

    const durationRow = await queryOne<{ value: Record<string, number> }>(
      `SELECT value FROM workshop.settings WHERE key = 'inspection_durations_default'`
    );
    const durations: Record<string, number> = durationRow?.value ?? {};

    const orderResult = await queryOne<{ id: string }>(`
      INSERT INTO workshop.orders
        (order_number, customer_id, part_number, quantity, priority, due_date, notes, is_simulated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [orderNumber, customerId ?? null, partNumber, quantity, priority,
        dueDate ?? null, notes ?? null, isSimulated ?? false]);

    if (!orderResult) throw new Error('Failed to insert order');
    const orderId = orderResult.id;

    const jobIds: string[] = [];
    for (let i = 0; i < inspectionTypes.length; i++) {
      const itype = inspectionTypes[i];
      const dur = durations[itype] ?? 60;
      const jobAllowedMachines = allowedMachines?.[itype] ?? null;

      const jobResult = await queryOne<{ id: string }>(`
        INSERT INTO workshop.jobs
          (order_id, inspection_type, sequence_index, duration_minutes, is_simulated, allowed_machines)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [orderId, itype, i, dur, isSimulated ?? false,
          jobAllowedMachines ? `{${jobAllowedMachines.join(',')}}` : null]);
      if (jobResult) jobIds.push(jobResult.id);
    }

    for (const jid of jobIds) {
      await scheduleNextAvailable(jid);
    }

    const orders = await fetchTodayOrders();
    const created = orders.find((o) => o.id === orderId) ?? { id: orderId };

    broadcastUpdate();
    return res.status(201).json(created);
  } catch (e) {
    console.error('POST /workshop/orders error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /workshop/simulation/clear ────────────────────────
router.delete('/simulation/clear', requirePermission('WORKSHOP_SCHEDULE_EDIT'), async (_req: Request, res: Response) => {
  try {
    await query(`DELETE FROM workshop.jobs WHERE is_simulated = true`);
    await query(`DELETE FROM workshop.orders WHERE is_simulated = true`);
    broadcastUpdate();
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /workshop/simulation/clear error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
