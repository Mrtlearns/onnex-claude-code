import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { jwtMiddleware } from './middleware/jwt';
import { loadPermissions } from './middleware/loadPermissions';
import { syncPermissions } from './lib/permissions/registry';
import quoteRouter from './routes/quote';
import rtQuoteRouter from './routes/rt-quote';
import quotesRouter from './routes/quotes';
import integrationsRouter from './routes/integrations';
import inspectionTypesRouter from './routes/inspection-types';
import settingsRouter from './routes/settings';
import bomRouter from './routes/bom';
import adminRouter from './routes/admin';
import documentsRouter from './routes/documents';
import sfAnalysisRouter from './routes/sf-analysis';
import rtPlanRouter from './routes/rt-plan';
import rtAnalyzeRouter from './routes/rt-analyze';
import workshopRouter from './routes/workshop';
import utRulesRouter from './routes/ut-rules';
import utCalculateRouter from './routes/ut-calculate';
import rbacRouter from './routes/rbac';
import feedbackRouter from './routes/feedback';
import inboxRouter from './routes/inbox';
import diagramAnalysesRouter from './routes/diagram-analyses';
import emailChecksRouter from './routes/email-checks';

const app = express();
const PORT = process.env.PORT ?? 3100;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({
  limit: '10mb',
  verify: (req: express.Request, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Authentication: JWT validation + DB permission resolution
app.use(jwtMiddleware);
app.use(loadPermissions);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ndt-ut-api', time: new Date().toISOString() });
});

// Routes
app.use('/quote', quoteRouter);                        // UT quote API
app.use('/rt/quote', rtQuoteRouter);                   // RT quote API
app.use('/quotes', quotesRouter);                      // Combined UT+RT quote history
app.use('/integrations', integrationsRouter);          // Salesforce + email stubs
app.use('/inspection-types', inspectionTypesRouter);   // Inspection types + steps
app.use('/settings', settingsRouter);                  // LLM + admin settings
app.use('/bom', bomRouter);                            // Salesforce BOM + history
app.use('/admin', adminRouter);                        // Admin: job runs, etc.
app.use('/documents', documentsRouter);               // Nextcloud document storage
app.use('/sf-analysis', sfAnalysisRouter);            // Salesforce analysis + AI chat
app.use('/rt', rtPlanRouter);                         // RT planning + machine catalog
app.use('/rt/analyze', rtAnalyzeRouter);              // RT two-stage LLM analysis
app.use('/workshop', workshopRouter);                 // Workshop dashboard
app.use('/ut-rules', utRulesRouter);                  // UT rule set CRUD + traces
app.use('/calculate', utCalculateRouter);             // UT rule engine calculate
app.use('/rbac', rbacRouter);                        // RBAC: roles, users, permissions
app.use('/feedback', feedbackRouter);                // Portal feedback → n8n → Gmail
app.use('/inbox', inboxRouter);                      // Email inbox quote pipeline
app.use('/api/inbox', inboxRouter);                  // n8n internal calls include /api prefix
app.use('/diagram-analyses', diagramAnalysesRouter); // Central LLM analysis store
app.use('/email-checks', emailChecksRouter);         // Email check settings CRUD

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

app.listen(PORT, async () => {
  console.log(`NDT UT API listening on :${PORT}`);

  // Sync permission registry from code manifests to DB
  try {
    const result = await syncPermissions();
    console.log(`[rbac] Registered ${result.registered} permissions across ${result.modules} modules (${result.deprecated} deprecated)`);
  } catch (err) {
    console.error('[rbac] Permission registry sync failed:', err);
  }
});

// Claude OAuth token health check — runs every 12 hours
cron.schedule('0 */12 * * *', async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/settings/claude-oauth/test`, { method: 'POST' });
    const body = await res.json();
    console.log('[claude_oauth_cron]', body);
  } catch (err) {
    console.error('[claude_oauth_cron] failed', err);
  }
});

// Daily purge of _deleted/ items older than 30 days — runs at 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/documents/maintenance`, { method: 'POST' });
    const body = await res.json();
    console.log('[doc_purge cron]', body);
  } catch (err) {
    console.error('[doc_purge cron] failed', err);
  }
});
