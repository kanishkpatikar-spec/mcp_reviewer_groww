import type { Review } from './ingestion.js';

export interface StratifiedReviews {
  critical: Review[];
  positive: Review[];
}

export interface BatchedReviews {
  criticalBatches: Review[][];
  positiveBatches: Review[][];
}

/**
 * Step 3.1: Sanitization & PII Stripping
 */
export function stripPII(text: string): string {
  if (!text) return text;
  
  // Remove email addresses
  let sanitized = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Remove phone numbers (basic 10 digit patterns often found in Indian reviews)
  sanitized = sanitized.replace(/\b\d{10}\b/g, '[PHONE]');
  
  return sanitized;
}

export function sanitizeReviews(reviews: Review[]): Review[] {
  return reviews.map(review => ({
    ...review,
    title: stripPII(review.title),
    text: stripPII(review.text)
  }));
}

/**
 * Step 3.2: Data Stratification
 */
export function stratifyReviews(reviews: Review[]): StratifiedReviews {
  const critical = reviews.filter(r => r.rating <= 3);
  const positive = reviews.filter(r => r.rating >= 4);
  return { critical, positive };
}

/**
 * Step 3.4: Batching & Chunking
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function prepareForAnalysis(reviews: Review[], batchSize: number = 50): BatchedReviews {
  // Step 3.1: Sanitize
  const sanitized = sanitizeReviews(reviews);
  
  // Step 3.2: Stratify
  const { critical, positive } = stratifyReviews(sanitized);
  
  // Step 3.4: Batch
  return {
    criticalBatches: chunkArray(critical, batchSize),
    positiveBatches: chunkArray(positive, batchSize)
  };
}
