/**
 * Phase 6: Weekly Scheduler
 * 
 * Runs the full Feedback Pulse pipeline on a configurable weekly schedule
 * using node-cron. By default, the pipeline executes every Monday at 9:00 AM.
 * 
 * Usage:
 *   npx tsx src/scheduler.ts              # Start the scheduler daemon
 *   npx tsx src/scheduler.ts --run-now    # Run once immediately, then start scheduler
 * 
 * Environment Variables:
 *   CRON_SCHEDULE     — Cron expression (default: "0 9 * * 1" = Monday 9 AM)
 *   CRON_TIMEZONE     — IANA timezone (default: "Asia/Kolkata")
 *   
 * All other .env variables from Phases 1-5 are also required:
 *   GROQ_API_KEY, MCP_SERVER_URL, STAKEHOLDER_EMAIL, GOOGLE_DOC_ID, etc.
 */
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { runFullPipeline, type PipelineResult } from './orchestrator.js';

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────

// Default: Every Monday at 9:00 AM
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * 1';
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Asia/Kolkata';

// ─── State ────────────────────────────────────────────────────────────────────

let isRunning = false;
let runCount = 0;
let lastRunResult: PipelineResult | null = null;

// ─── Pipeline Execution Wrapper ───────────────────────────────────────────────

async function executePipeline(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] ⚠️  Pipeline is already running. Skipping this trigger.');
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

    if (lastRunResult.success) {
      console.log(`[Scheduler] ✅ Pipeline run #${runNumber} completed successfully.`);
    } else {
      console.error(`[Scheduler] ❌ Pipeline run #${runNumber} completed with errors.`);
      logPhaseErrors(lastRunResult);
    }
  } catch (err: any) {
    console.error(`[Scheduler] ❌ Pipeline run #${runNumber} crashed:`, err.message);
  } finally {
    isRunning = false;
    const next = getNextRunTime();
    if (next) {
      console.log(`[Scheduler] ⏰ Next scheduled run: ${next}\n`);
    }
  }
}

function logPhaseErrors(result: PipelineResult): void {
  const phases = result.phases;
  if (phases.ingestion.error)    console.error(`  • Ingestion:    ${phases.ingestion.error}`);
  if (phases.sanitization.error) console.error(`  • Sanitization: ${phases.sanitization.error}`);
  if (phases.analysis.error)     console.error(`  • Analysis:     ${phases.analysis.error}`);
  if (phases.delivery.error)     console.error(`  • Delivery:     ${phases.delivery.error}`);
}

// ─── Cron Helpers ─────────────────────────────────────────────────────────────

function describeCronSchedule(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let description = '';
  
  if (dayOfWeek !== '*' && dayOfMonth === '*' && month === '*') {
    const dayNum = parseInt(dayOfWeek!, 10);
    const dayName = dayNames[dayNum] || `day ${dayOfWeek}`;
    description = `Every ${dayName}`;
  } else if (dayOfMonth !== '*') {
    description = `On day ${dayOfMonth} of the month`;
  } else {
    description = 'Every day';
  }

  if (hour !== '*' && minute !== '*') {
    const h = parseInt(hour!, 10);
    const m = parseInt(minute!, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    description += ` at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  return description;
}

function getNextRunTime(): string | null {
  try {
    // Calculate approximate next run time from cron expression
    const parts = CRON_SCHEDULE.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour, , , dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    if (hour !== '*') next.setHours(parseInt(hour!, 10));
    if (minute !== '*') next.setMinutes(parseInt(minute!, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (dayOfWeek !== '*') {
      const targetDay = parseInt(dayOfWeek!, 10);
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setDate(now.getDate() + daysUntil);
    } else if (next <= now) {
      next.setDate(now.getDate() + 1);
    }

    return next.toLocaleString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📅 Feedback Pulse Scheduler                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Validate cron expression
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron expression: "${CRON_SCHEDULE}"`);
    console.error('   Set CRON_SCHEDULE in .env to a valid 5-field cron expression.');
    console.error('   Examples:');
    console.error('     "0 9 * * 1"    → Every Monday at 9:00 AM');
    console.error('     "0 10 * * 5"   → Every Friday at 10:00 AM');
    console.error('     "30 8 * * 1-5" → Weekdays at 8:30 AM');
    process.exit(1);
  }

  const scheduleDesc = describeCronSchedule(CRON_SCHEDULE);

  console.log(`  Schedule:  ${CRON_SCHEDULE} (${scheduleDesc})`);
  console.log(`  Timezone:  ${CRON_TIMEZONE}`);
  console.log(`  MCP URL:   ${process.env.MCP_SERVER_URL || '(not set)'}`);
  console.log(`  Email To:  ${process.env.STAKEHOLDER_EMAIL || '(not set)'}`);
  console.log(`  Doc ID:    ${process.env.GOOGLE_DOC_ID || '(not set)'}`);
  console.log('');

  // Check for --run-now flag
  const runNow = process.argv.includes('--run-now');

  if (runNow) {
    console.log('[Scheduler] 🏃 --run-now flag detected. Running pipeline immediately...\n');
    await executePipeline();
  }

  // Start cron schedule
  console.log(`[Scheduler] ⏰ Scheduling pipeline: ${scheduleDesc} (${CRON_TIMEZONE})`);

  const task = cron.schedule(CRON_SCHEDULE, () => {
    executePipeline();
  }, {
    timezone: CRON_TIMEZONE
  });

  const nextRun = getNextRunTime();
  if (nextRun) {
    console.log(`[Scheduler] ⏰ Next scheduled run: ${nextRun}`);
  }
  console.log('[Scheduler] 🟢 Scheduler is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Scheduler] 🛑 Shutting down...');
    task.stop();
    console.log('[Scheduler] Scheduler stopped. Total runs:', runCount);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Scheduler] 🛑 Received SIGTERM. Shutting down...');
    task.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal scheduler error:', err);
  process.exit(1);
});
