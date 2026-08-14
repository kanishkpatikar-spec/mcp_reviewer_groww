/**
 * Phase 5 Runner: MCP Integration (Google Docs & Gmail)
 * 
 * Reads the final_report.json from Phase 4 and delivers it via:
 *   1. Google Docs (append to an existing document)
 *   2. Gmail (create a draft email to stakeholders)
 * 
 * Usage:
 *   npx tsx src/run_delivery.ts
 * 
 * Required .env variables:
 *   MCP_SERVER_URL=https://mcpserver-production-b397.up.railway.app
 *   STAKEHOLDER_EMAIL=user@example.com
 *   GOOGLE_DOC_ID=<optional - your google doc id>
 */
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { deliverReport, type FinalReport, type DeliveryResult } from './delivery.js';

dotenv.config();

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Phase 5: MCP Integration (Google Docs & Gmail)');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Validate environment ────────────────────────────────────
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!mcpUrl) {
    console.error('ERROR: MCP_SERVER_URL is not set in .env');
    console.error('Add: MCP_SERVER_URL=https://mcpserver-production-b397.up.railway.app');
    process.exit(1);
  }

  const stakeholderEmail = process.env.STAKEHOLDER_EMAIL;
  const googleDocId = process.env.GOOGLE_DOC_ID;

  console.log(`MCP Server:        ${mcpUrl}`);
  console.log(`Stakeholder Email: ${stakeholderEmail || '(not set — Gmail draft will be skipped)'}`);
  console.log(`Google Doc ID:     ${googleDocId || '(not set — Docs append will be skipped)'}`);
  console.log('');

  if (!stakeholderEmail && !googleDocId) {
    console.error('ERROR: At least one of STAKEHOLDER_EMAIL or GOOGLE_DOC_ID must be set in .env');
    process.exit(1);
  }

  // ── Load final report ────────────────────────────────────────
  const reportPath = 'final_report.json';
  let report: FinalReport;
  
  try {
    const raw = await fs.readFile(reportPath, 'utf-8');
    report = JSON.parse(raw) as FinalReport;
    console.log('✅ Loaded final report from', reportPath);
    console.log(`   - ${report.top_critical_issues.length} critical issues`);
    console.log(`   - ${report.top_feature_requests.length} feature requests`);
    console.log(`   - ${report.quotes.length} quotes`);
    console.log(`   - ${report.actionable_ideas.length} actionable ideas`);
    console.log(`   - Email summary: ${report.email_summary.split(/\s+/).length} words`);
  } catch (err) {
    console.error(`ERROR: Could not read ${reportPath}.`);
    console.error('Make sure Phase 4 (run_analysis.ts) has been executed first.');
    process.exit(1);
  }

  // ── Deliver via MCP ──────────────────────────────────────────
  console.log('\nStarting delivery...\n');
  
  try {
    const result: DeliveryResult = await deliverReport(report);

    // ── Summary ────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════');
    console.log(' Delivery Summary');
    console.log('═══════════════════════════════════════════════════');
    
    if (googleDocId) {
      console.log(`  Google Docs: ${result.docsSuccess ? '✅ Success' : '❌ Failed'}`);
      if (result.docsUrl) console.log(`    URL: ${result.docsUrl}`);
    } else {
      console.log('  Google Docs: ⏭️  Skipped (no GOOGLE_DOC_ID)');
    }

    if (stakeholderEmail) {
      console.log(`  Gmail Draft: ${result.gmailDraftSuccess ? '✅ Success' : '❌ Failed'}`);
      if (result.gmailDraftId) console.log(`    Draft ID: ${result.gmailDraftId}`);
    } else {
      console.log('  Gmail Draft: ⏭️  Skipped (no STAKEHOLDER_EMAIL)');
    }

    console.log('═══════════════════════════════════════════════════\n');

    // Save delivery result
    const deliveryResultPath = 'delivery_result.json';
    await fs.writeFile(deliveryResultPath, JSON.stringify(result, null, 2));
    console.log(`Delivery result saved to ${deliveryResultPath}`);

    // Exit with error code if both deliveries failed
    if (googleDocId && stakeholderEmail && !result.docsSuccess && !result.gmailDraftSuccess) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Delivery failed:', err);
    process.exit(1);
  }
}

main();
