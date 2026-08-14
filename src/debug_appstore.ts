import appStore from 'app-store-scraper';

async function main() {
  try {
    const rawReviews = await appStore.reviews({
      appId: 'com.nextbillion.groww',
      sort: appStore.sort.RECENT,
      page: 1,
      country: 'in'
    });
    
    console.log(`Fetched ${rawReviews.length} reviews from page 1`);
    if (rawReviews.length > 0) {
      console.log('First review date field:', rawReviews[0].updated || rawReviews[0].date);
      console.log('Parsed Date object:', new Date(rawReviews[0].updated || rawReviews[0].date));
      console.log('First review payload:', JSON.stringify(rawReviews[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
