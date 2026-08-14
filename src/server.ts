/**
 * API Server + Scheduler
 * 
 * Combines the Express API server with the cron scheduler so Railway
 * can expose a public domain while the scheduler runs in the background.
 * 
 * Endpoints:
 *   GET  /api/report    — Returns the latest final_report.json
 *   GET  /api/status    — Returns pipeline/scheduler status
 *   POST /api/trigger   — Triggers an immediate pipeline run
 *   GET  /health        — Health check
 */
import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { runFullPipeline, type PipelineResult } from './orchestrator.js';

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * 1';
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Asia/Kolkata';
const API_SECRET = process.env.API_SECRET_KEY || '';

// ─── Scheduler State ─────────────────────────────────────────────────────────

let isRunning = false;
let runCount = 0;
let lastRunResult: PipelineResult | null = null;
let lastRunAt: Date | null = null;

// ─── Pipeline Execution ──────────────────────────────────────────────────────

async function executePipeline(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] ⚠️  Pipeline is already running. Skipping.');
    return;
  }

  isRunning = true;
  runCount++;
  const runNumber = runCount;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[Scheduler] 🚀 Starting pipeline run #${runNumber}`);
  console.log(`[Scheduler]    Triggered at: ${new Date().toLocaleString()}`);
  console.log(`${'═'.repeat(60)}\n`);

  try {
    lastRunResult = await runFullPipeline();
    lastRunAt = new Date();

    if (lastRunResult.success) {
      console.log(`[Scheduler] ✅ Pipeline run #${runNumber} completed successfully.`);
    } else {
      console.error(`[Scheduler] ❌ Pipeline run #${runNumber} completed with errors.`);
    }
  } catch (err: any) {
    console.error(`[Scheduler] ❌ Pipeline run #${runNumber} crashed:`, err.message);
  } finally {
    isRunning = false;
  }
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// GET /api/report — serve the latest report
app.get('/api/report', async (_req, res) => {
  try {
    const data = await fs.readFile('final_report.json', 'utf-8');
    const report = JSON.parse(data);

    // Also try to read delivery result
    let delivery = null;
    try {
      const deliveryData = await fs.readFile('delivery_result.json', 'utf-8');
      delivery = JSON.parse(deliveryData);
    } catch {
      // delivery_result.json may not exist yet
    }

    res.json({
      report,
      delivery,
      generatedAt: lastRunAt?.toISOString() || null,
    });
  } catch {
    res.status(404).json({ error: 'No report available yet. Pipeline has not run.' });
  }
});

// GET /api/status — scheduler and pipeline status
app.get('/api/status', (_req, res) => {
  res.json({
    schedulerRunning: true,
    pipelineRunning: isRunning,
    totalRuns: runCount,
    lastRunAt: lastRunAt?.toISOString() || null,
    lastRunSuccess: lastRunResult?.success ?? null,
    cronSchedule: CRON_SCHEDULE,
    cronTimezone: CRON_TIMEZONE,
  });
});

// POST /api/trigger — manually trigger the pipeline
app.post('/api/trigger', (req, res) => {
  // Simple auth check
  if (API_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${API_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  if (isRunning) {
    res.status(409).json({ error: 'Pipeline is already running.' });
    return;
  }

  // Fire and forget — don't wait for pipeline to finish
  executePipeline();
  res.json({ message: 'Pipeline triggered successfully.', runNumber: runCount });
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📊 Feedback Pulse — API Server + Scheduler            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Validate cron
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron expression: "${CRON_SCHEDULE}"`);
    process.exit(1);
  }

  // Start cron scheduler
  cron.schedule(CRON_SCHEDULE, () => {
    executePipeline();
  }, { timezone: CRON_TIMEZONE });

  console.log(`  Cron:      ${CRON_SCHEDULE} (${CRON_TIMEZONE})`);
  console.log(`  Port:      ${PORT}`);
  console.log(`  MCP URL:   ${process.env.MCP_SERVER_URL || '(not set)'}`);
  console.log('');

  // Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] 🟢 API server listening on port ${PORT}`);
    console.log(`[Server] 🟢 Scheduler active. Waiting for cron trigger...\n`);
  });
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
