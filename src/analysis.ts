import Groq from 'groq-sdk';
import type { Review } from './ingestion.js';
import type { BatchedReviews } from './sanitization.js';
import * as dotenv from 'dotenv';

dotenv.config();

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// Using a fast model for Map steps and a larger model for synthesis if needed,
// but Llama 3 8B or 70B works well for both. Let's use 8B for speed on batches, 70B for synthesis.
const MAP_MODEL = 'llama-3.1-8b-instant';
const REDUCE_MODEL = 'llama-3.3-70b-versatile';

export async function processBatch(batch: Review[], type: 'critical' | 'positive', batchIndex: number): Promise<string> {
  const reviewsText = batch.map(r => `[Rating: ${r.rating}]: ${r.text}`).join('\n---\n');
  
  const systemPrompt = type === 'critical'
    ? 'You are an expert product analyst. Extract up to 3 bug/complaint themes from these critical reviews. For each theme, include one exact verbatim quote from the reviews that strongly supports it. Respond concisely. DO NOT include review IDs or review numbers in your output.'
    : 'You are an expert product analyst. Extract up to 3 feature request themes from these positive reviews. For each theme, include one exact verbatim quote from the reviews that strongly supports it. Respond concisely. DO NOT include review IDs or review numbers in your output.';
    
  const userPrompt = `Reviews Batch:\n${reviewsText}\n\nPlease extract the themes and exact quotes as requested.`;

  try {
    const completion = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: MAP_MODEL,
      temperature: 0.1,
    });
    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Error processing ${type} batch ${batchIndex}:`, error);
    return '';
  }
}

export async function synthesizeThemes(criticalThemes: string[], positiveThemes: string[]): Promise<any> {
  const systemPrompt = `You are an expert product manager. You are given a list of extracted themes and verbatim quotes from critical reviews and positive reviews.
Your task is to distill these into a final actionable report.
Format your output EXACTLY as a JSON object matching this schema, without any markdown formatting outside the JSON:
{
  "top_critical_issues": ["Issue 1", "Issue 2", "Issue 3"],
  "top_feature_requests": ["Feature 1", "Feature 2", "Feature 3"],
  "quotes": ["Exact Quote 1", "Exact Quote 2", "Exact Quote 3"],
  "actionable_ideas": ["Idea 1", "Idea 2", "Idea 3"],
  "email_summary": "A scannable high-level summary of the insights, STRICTLY under 250 words. Focus on the most critical takeaways."
}
IMPORTANT: The email_summary MUST be under 250 words. The quotes MUST be exact verbatim quotes chosen from the provided context. DO NOT include review IDs, numbers, or reviewer names in the themes, quotes, or ideas.`;

  const userPrompt = `Critical Themes (from all batches):\n${criticalThemes.join('\n\n---\n\n')}\n\nPositive Themes (from all batches):\n${positiveThemes.join('\n\n---\n\n')}\n\nPlease generate the JSON report.`;

  try {
    const completion = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: REDUCE_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error during synthesis:`, error);
    return null;
  }
}

// Helper for artificial delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function runAnalysisPipeline(batchedData: BatchedReviews) {
  const validCritical: string[] = [];
  console.log(`Processing ${batchedData.criticalBatches.length} critical batches (Map step) sequentially...`);
  for (let idx = 0; idx < batchedData.criticalBatches.length; idx++) {
    const batch = batchedData.criticalBatches[idx]!;
    console.log(`- Critical batch ${idx + 1}/${batchedData.criticalBatches.length}`);
    const theme = await processBatch(batch, 'critical', idx);
    if (theme.trim().length > 0) validCritical.push(theme);
    
    if (idx < batchedData.criticalBatches.length - 1) {
      console.log('  Waiting 20 seconds for rate limits...');
      await delay(20000);
    }
  }

  if (batchedData.criticalBatches.length > 0 && batchedData.positiveBatches.length > 0) {
    console.log('Waiting 20 seconds before starting positive batches...');
    await delay(20000);
  }

  const validPositive: string[] = [];
  console.log(`Processing ${batchedData.positiveBatches.length} positive batches (Map step) sequentially...`);
  for (let idx = 0; idx < batchedData.positiveBatches.length; idx++) {
    const batch = batchedData.positiveBatches[idx]!;
    console.log(`- Positive batch ${idx + 1}/${batchedData.positiveBatches.length}`);
    const theme = await processBatch(batch, 'positive', idx);
    if (theme.trim().length > 0) validPositive.push(theme);
    
    if (idx < batchedData.positiveBatches.length - 1) {
      console.log('  Waiting 20 seconds for rate limits...');
      await delay(20000);
    }
  }

  console.log('Waiting 30 seconds before synthesizing final report to clear TPM bucket...');
  await delay(30000);

  console.log('Synthesizing final report (Reduce step)...');
  
  // Truncate to ensure the final synthesis prompt strictly stays under the 1K TPM limit
  // 1 token ~= 4 chars roughly. 1000 tokens ~= 4000 chars. We restrict each bucket to 1500 chars.
  const maxLen = 1500;
  const allCriticalText = validCritical.join('\n---\n');
  const allPositiveText = validPositive.join('\n---\n');
  
  const safeCritical = allCriticalText.length > maxLen ? allCriticalText.substring(0, maxLen) + '... (truncated)' : allCriticalText;
  const safePositive = allPositiveText.length > maxLen ? allPositiveText.substring(0, maxLen) + '... (truncated)' : allPositiveText;

  const finalReport = await synthesizeThemes([safeCritical], [safePositive]);
  
  return finalReport;
}
