import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

const FEEDBACK_TYPES = [
  'Bug Report',
  'UI/UX Issue',
  'Feature Request',
  'Performance Issue',
  'Data/Accuracy Issue',
  'Other',
] as const;

const PRIORITY_LEVELS = [
  'Critical',
  'High',
  'Medium',
  'Low',
] as const;

const FeedbackSchema = z.object({
  type:          z.enum(FEEDBACK_TYPES),
  priority:      z.enum(PRIORITY_LEVELS),
  description:   z.string().min(10).max(5000),
  page_url:      z.string().url().or(z.string().startsWith('/')),
  user_email:    z.string().email().or(z.literal('')),
  user_name:     z.string().max(200),
  screenshot_b64: z.string()
    .refine(v => v.startsWith('data:image/'), 'Must be a data URI image')
    .optional(),
});

/**
 * POST /feedback
 * Accepts feedback from portal users and forwards to n8n WF-6 for Gmail delivery.
 * No permission gate — any authenticated portal user may submit feedback.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = FeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid feedback payload', details: parsed.error.flatten() });
    return;
  }

  const n8nUrl    = process.env.N8N_FEEDBACK_WEBHOOK_URL
    ?? `http://n8n:5678/webhook/ndt-feedback`;
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET ?? '';

  try {
    const n8nRes = await fetch(n8nUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-N8N-Token':   n8nSecret,
      },
      body: JSON.stringify(parsed.data),
      // 15-second timeout: n8n may be slow if it's processing
      signal: AbortSignal.timeout(15_000),
    });

    if (!n8nRes.ok) {
      console.error('[feedback] n8n returned non-2xx:', n8nRes.status, await n8nRes.text());
      res.status(502).json({ error: 'Feedback service unavailable' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[feedback] Failed to forward to n8n:', err);
    res.status(503).json({ error: 'Feedback could not be delivered' });
  }
});

export default router;
