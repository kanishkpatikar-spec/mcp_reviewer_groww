/**
 * Phase 6: Full Pipeline Orchestrator
 * 
 * Ties Phases 2 → 5 together into a single automated run:
 *   Phase 2: Data Ingestion (fetch reviews from Play Store & App Store)
 *   Phase 3: Sanitization & Pre-Analysis (PII stripping, stratification, batching)
 *   Phase 4: AI Processing (Map-Reduce clustering & synthesis via Groq)
 *   Phase 5: MCP Delivery (Google Docs + Gmail)
 * 
 * Each phase has error handling and will log progress.
 * The orchestrator can be called programmatically or run as a standalone script.
 */
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { fetchAllReviews, type Review } from './ingestion.js';
import { prepareForAnalysis, type BatchedReviews } from './sanitization.js';
import { runAnalysisPipeline } from './analysis.js';
import { deliverReport, type FinalReport, type DeliveryResult } from './delivery.js';

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────

const PLAY_STORE_ID = process.env.PLAY_STORE_ID || 'com.nextbillion.groww';
const APP_STORE_ID = process.env.APP_STORE_ID || '1404877526';
const COUNTRY = process.env.APP_COUNTRY || 'in';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '15', 10);

// ─── Phase Result Types ───────────────────────────────────────────────────────

export interface PipelineResult {
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  phases: {
    ingestion: { success: boolean; reviewCount: number; error?: string };
    sanitization: { success: boolean; criticalCount: number; positiveCount: number; error?: string };
    analysis: { success: boolean; error?: string };
    delivery: { success: boolean; result?: DeliveryResult; error?: string };
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function runFullPipeline(): Promise<PipelineResult> {
  const startedAt = new Date();
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📊 Mobile Store Feedback Pulse — Full Pipeline Run     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  Started at: ${startedAt.toLocaleString()}\n`);

  const result: PipelineResult = {
    success: false,
    startedAt,
    completedAt: new Date(),
    phases: {
      ingestion: { success: false, reviewCount: 0 },
      sanitization: { success: false, criticalCount: 0, positiveCount: 0 },
      analysis: { success: false },
      delivery: { success: false },
    },
  };

  // ──────────────────────────────────────────────────────────────────────
  // Phase 2: Data Ingestion
  // ──────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Phase 2: Data Ingestion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let reviews: Review[];
  try {
    console.log(`  Play Store ID: ${PLAY_STORE_ID}`);
    console.log(`  App Store ID:  ${APP_STORE_ID}`);
    console.log(`  Country:       ${COUNTRY}\n`);

    reviews = await fetchAllReviews(PLAY_STORE_ID, APP_STORE_ID, COUNTRY);
    console.log(`\n  ✅ Fetched ${reviews.length} reviews.\n`);

    // Save intermediate output
    await fs.writeFile('reviews.json', JSON.stringify(reviews, null, 2));

    result.phases.ingestion = { success: true, reviewCount: reviews.length };

    if (reviews.length === 0) {
      console.warn('  ⚠️  No reviews found. Aborting pipeline.');
      result.phases.ingestion.error = 'No reviews found';
      result.completedAt = new Date();
      return result;
    }
  } catch (err: any) {
    console.error('  ❌ Ingestion failed:', err.message);
    result.phases.ingestion.error = err.message;
    result.completedAt = new Date();
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 3: Sanitization & Pre-Analysis
  // ──────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Phase 3: Sanitization & Pre-Analysis Strategy');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let batchedReviews: BatchedReviews;
  try {
    batchedReviews = prepareForAnalysis(reviews, BATCH_SIZE);

    const criticalCount = batchedReviews.criticalBatches.flat().length;
    const positiveCount = batchedReviews.positiveBatches.flat().length;

    console.log(`  Critical reviews: ${criticalCount} in ${batchedReviews.criticalBatches.length} batches`);
    console.log(`  Positive reviews: ${positiveCount} in ${batchedReviews.positiveBatches.length} batches`);
    console.log(`  Batch size: ${BATCH_SIZE}\n`);
    console.log(`  ✅ Sanitization complete.\n`);

    // Save intermediate output
    await fs.writeFile('processed_reviews.json', JSON.stringify(batchedReviews, null, 2));

    result.phases.sanitization = { success: true, criticalCount, positiveCount };
  } catch (err: any) {
    console.error('  ❌ Sanitization failed:', err.message);
    result.phases.sanitization.error = err.message;
    result.completedAt = new Date();
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 4: AI Processing (Map-Reduce)
  // ──────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Phase 4: AI Processing (Map-Reduce Clustering & Synthesis)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    const msg = 'GROQ_API_KEY is missing or invalid in .env';
    console.error(`  ❌ ${msg}`);
    result.phases.analysis.error = msg;
    result.completedAt = new Date();
    return result;
  }

  let finalReport: FinalReport;
  try {
    const report = await runAnalysisPipeline(batchedReviews);
    if (!report) {
      throw new Error('Analysis returned null — LLM output may be malformed');
    }
    finalReport = report as FinalReport;

    console.log(`\n  ✅ Analysis complete.`);
    console.log(`     - ${finalReport.top_critical_issues.length} critical issues`);
    console.log(`     - ${finalReport.top_feature_requests.length} feature requests`);
    console.log(`     - ${finalReport.quotes.length} verbatim quotes`);
    console.log(`     - ${finalReport.actionable_ideas.length} actionable ideas`);
    console.log(`     - Email summary: ${finalReport.email_summary.split(/\s+/).length} words\n`);

    // Save intermediate output
    await fs.writeFile('final_report.json', JSON.stringify(finalReport, null, 2));

    result.phases.analysis = { success: true };
  } catch (err: any) {
    console.error('  ❌ Analysis failed:', err.message);
    result.phases.analysis.error = err.message;
    result.completedAt = new Date();
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 5: MCP Delivery (Google Docs + Gmail)
  // ──────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Phase 5: MCP Integration (Google Docs & Gmail)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.MCP_SERVER_URL) {
    const msg = 'MCP_SERVER_URL is not set in .env';
    console.error(`  ❌ ${msg}`);
    result.phases.delivery.error = msg;
    result.completedAt = new Date();
    return result;
  }

  try {
    const deliveryResult = await deliverReport(finalReport);
    result.phases.delivery = { success: true, result: deliveryResult };

    console.log(`\n  ✅ Delivery complete.`);
    if (deliveryResult.docsSuccess) {
      console.log(`     - Google Docs: ${deliveryResult.docsUrl}`);
    }
    if (deliveryResult.gmailDraftSuccess) {
      console.log(`     - Gmail Draft ID: ${deliveryResult.gmailDraftId}`);
    }
    console.log('');

    // Save delivery result
    await fs.writeFile('delivery_result.json', JSON.stringify(deliveryResult, null, 2));
  } catch (err: any) {
    console.error('  ❌ Delivery failed:', err.message);
    result.phases.delivery.error = err.message;
    result.completedAt = new Date();
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Done
  // ──────────────────────────────────────────────────────────────────────
  result.success = true;
  result.completedAt = new Date();

  const durationMs = result.completedAt.getTime() - result.startedAt.getTime();
  const durationMin = (durationMs / 60000).toFixed(1);

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Pipeline Complete                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  Duration: ${durationMin} minutes`);
  console.log(`  Reviews processed: ${result.phases.ingestion.reviewCount}`);
  console.log(`  All phases succeeded: ${result.success}\n`);

  // Save full pipeline result
  await fs.writeFile('pipeline_result.json', JSON.stringify(result, null, 2));

  return result;
}

// ─── Standalone execution ─────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.endsWith('orchestrator.ts') ||
                     process.argv[1]?.endsWith('orchestrator.js');

if (isMainModule) {
  runFullPipeline()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal orchestrator error:', err);
      process.exit(1);
    });
}
