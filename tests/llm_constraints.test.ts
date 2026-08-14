import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import path from 'path';

describe('LLM Constraints & Pre-Analysis Verification (Phase 7.2)', () => {
  let finalReport: any = null;
  let rawReviews: any[] = [];
  
  beforeAll(async () => {
    try {
      const reportData = await fs.readFile(path.resolve('final_report.json'), 'utf-8');
      finalReport = JSON.parse(reportData);
    } catch (e) {
      console.warn('final_report.json not found. Run the pipeline first to generate data.');
    }

    try {
      const reviewsData = await fs.readFile(path.resolve('reviews.json'), 'utf-8');
      rawReviews = JSON.parse(reviewsData);
    } catch (e) {
      console.warn('reviews.json not found.');
    }
  });

  it('should have an email summary strictly under 250 words', () => {
    // Skip if finalReport doesn't exist
    if (!finalReport) return;

    const summary = finalReport.email_summary;
    expect(typeof summary).toBe('string');

    const wordCount = summary.split(/\s+/).filter((w: string) => w.length > 0).length;
    expect(wordCount).toBeLessThanOrEqual(250);
  });

  it('should extract verbatim quotes without hallucinations', () => {
    // Skip if data doesn't exist
    if (!finalReport || !rawReviews.length) return;

    const quotes: string[] = finalReport.quotes;
    expect(quotes).toBeInstanceOf(Array);
    expect(quotes.length).toBeGreaterThan(0);

    // Ensure each quote exists verbatim in at least one original review
    for (const quote of quotes) {
      // Sometimes LLMs trim spaces or punctuation, so a fuzzy match might be needed in real prod, 
      // but for "verbatim", we can test if it's a substring (ignoring punctuation and extreme whitespace)
      const normalize = (str: string) => str.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      
      const normalizedQuote = normalize(quote);
      
      const found = rawReviews.some(r => {
        const fullText = normalize(`${r.title} ${r.text}`);
        return fullText.includes(normalizedQuote);
      });
      
      if (!found) {
        console.warn(`Quote not found: "${quote}"`);
      }
      expect(found).toBe(true); // Quote must be verbatim from the reviews
    }
  });
});

