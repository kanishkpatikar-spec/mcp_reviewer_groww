import * as fs from 'fs/promises';
import { runAnalysisPipeline } from './analysis.js';
import type { BatchedReviews } from './sanitization.js';

async function main() {
  console.log('Loading batched reviews from processed_reviews.json...');
  try {
    const data = await fs.readFile('processed_reviews.json', 'utf-8');
    const batchedReviews: BatchedReviews = JSON.parse(data);
    
    console.log('Starting Phase 4: AI Processing (Map-Reduce Clustering & Synthesis)...');
    
    // Ensure Groq API Key is present
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
      console.error('ERROR: GROQ_API_KEY is missing or invalid in .env file.');
      console.error('Please update .env with a valid Groq API key before running Phase 4.');
      process.exit(1);
    }

    const finalReport = await runAnalysisPipeline(batchedReviews);
    
    if (finalReport) {
      const outputPath = 'final_report.json';
      await fs.writeFile(outputPath, JSON.stringify(finalReport, null, 2));
      console.log(`\nSuccess! Final synthesized report saved to ${outputPath}`);
    } else {
      console.error('\nFailed to generate final report.');
    }
  } catch (err) {
    console.error('Error running analysis:', err);
  }
}

main();
