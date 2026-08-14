import { describe, it, expect } from 'vitest';
import { fetchPlayStoreReviews, fetchAppStoreReviews } from '../src/ingestion.js';

// TWELVE_WEEKS_MS is exported or can be calculated
const TWELVE_WEEKS_MS = 12 * 7 * 24 * 60 * 60 * 1000;

describe('Data Ingestion Layer (Phase 7.1)', () => {
  it('should fetch Play Store reviews within the last 12 weeks', async () => {
    const reviews = await fetchPlayStoreReviews('com.nextbillion.groww', 'in');
    expect(reviews).toBeInstanceOf(Array);
    
    if (reviews.length > 0) {
      const cutoffDate = new Date(Date.now() - TWELVE_WEEKS_MS);
      for (const review of reviews) {
        expect(review.date.getTime()).toBeGreaterThanOrEqual(cutoffDate.getTime());
        expect(review.source).toBe('Google Play');
      }
    }
  }, 30000); // 30s timeout

  it('should fetch App Store reviews within the last 12 weeks', async () => {
    const reviews = await fetchAppStoreReviews('1404877526', 'in');
    expect(reviews).toBeInstanceOf(Array);

    if (reviews.length > 0) {
      const cutoffDate = new Date(Date.now() - TWELVE_WEEKS_MS);
      for (const review of reviews) {
        expect(review.date.getTime()).toBeGreaterThanOrEqual(cutoffDate.getTime());
        expect(review.source).toBe('Apple App Store');
      }
    }
  }, 30000); // 30s timeout
});
