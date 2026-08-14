import * as fs from 'fs/promises';
import { prepareForAnalysis } from './sanitization.js';
import type { Review } from './ingestion.js';

async function main() {
  console.log('Loading reviews from reviews.json...');
  try {
    const data = await fs.readFile('reviews.json', 'utf-8');
    // Ensure date strings are parsed back to Date objects if needed, 
    // although our sanitization logic doesn't strictly depend on Date objects.
    const reviews: Review[] = JSON.parse(data);
    
    console.log(`Loaded ${reviews.length} reviews.`);
    
    // Process reviews (Phase 3)
    console.log('Running Phase 3: Sanitization & Pre-Analysis Strategy...');
    const batchedReviews = prepareForAnalysis(reviews, 15); // Batch size 15 to fit within 1K TPM limit
    
    console.log(`Stratification and Batching complete:`);
    console.log(`- Critical Reviews (1-3 stars): ${batchedReviews.criticalBatches.flat().length} reviews in ${batchedReviews.criticalBatches.length} batches`);
    console.log(`- Positive Reviews (4-5 stars): ${batchedReviews.positiveBatches.flat().length} reviews in ${batchedReviews.positiveBatches.length} batches`);
    
    const outputPath = 'processed_reviews.json';
    await fs.writeFile(outputPath, JSON.stringify(batchedReviews, null, 2));
    console.log(`Processed and batched reviews saved to ${outputPath} for Phase 4 AI processing.`);
  } catch (err) {
    console.error('Error processing reviews:', err);
  }
}

main();
