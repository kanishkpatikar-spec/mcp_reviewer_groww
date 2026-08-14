import { fetchAllReviews } from './ingestion.js';
import * as fs from 'fs/promises';

async function main() {
  // Groww App IDs
  const PLAY_STORE_ID = 'com.nextbillion.groww';
  // app-store-scraper usually accepts either the string bundle ID or numeric ID for reviews. We use numeric ID here.
  const APP_STORE_ID = '1404877526'; 

  console.log(`Starting review download for Groww app...`);
  console.log(`Play Store ID: ${PLAY_STORE_ID}`);
  console.log(`App Store ID: ${APP_STORE_ID}`);
  
  try {
    const reviews = await fetchAllReviews(PLAY_STORE_ID, APP_STORE_ID, 'in');
    
    console.log(`\nSuccessfully fetched a total of ${reviews.length} reviews.`);
    
    const outputPath = 'reviews.json';
    await fs.writeFile(outputPath, JSON.stringify(reviews, null, 2));
    
    console.log(`Reviews saved to ${outputPath}`);
  } catch (error) {
    console.error('Error downloading reviews:', error);
  }
}

main();
