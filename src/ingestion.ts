import gplay from 'google-play-scraper';
import appStore from 'app-store-scraper';

export interface Review {
  source: string;
  date: Date;
  rating: number;
  title: string;
  text: string;
}

// 1 week in milliseconds (since pipeline runs daily now)
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isReviewValid(title: string, text: string): boolean {
  const fullText = `${title} ${text}`.trim();
  if (!fullText) return false;
  
  // 1. Reviews which have less than 8 words are not required
  const wordCount = fullText.split(/\s+/).length;
  if (wordCount < 8) return false;

  // 2. Reviews which have emoji are not required
  const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
  if (emojiRegex.test(fullText)) return false;

  // 3. Reviews in hindi language are not required
  // Hindi text typically uses the Devanagari script (U+0900 to U+097F)
  const hindiRegex = /[\u0900-\u097F]/;
  if (hindiRegex.test(fullText)) return false;

  return true;
}

export async function fetchPlayStoreReviews(appId: string, country: string = 'us'): Promise<Review[]> {
  const cutoffDate = new Date(Date.now() - ONE_WEEK_MS);
  
  console.log(`Fetching Google Play reviews for ${appId}...`);
  // Note: gplay.reviews can fetch up to a limit or paginate. 
  // For simplicity, we fetch a large chunk of newest reviews and filter by date.
  const rawReviews = await gplay.reviews({
    appId: appId,
    // @ts-ignore - The 'sort' property is incorrectly typed in google-play-scraper as an enum value instead of the enum object
    sort: gplay.sort.NEWEST,
    country: country,
    num: 500 // Fetch up to 500 reviews for the weekly window to avoid rate-limit hangs
  });

  const reviews: Review[] = [];
  for (const item of rawReviews.data) {
    const reviewDate = new Date(item.date);
    if (reviewDate >= cutoffDate) {
      const title = item.title || '';
      const text = item.text || '';
      if (isReviewValid(title, text)) {
        reviews.push({
          source: 'Google Play',
          date: reviewDate,
          rating: item.score,
          title: title,
          text: text
        });
      }
    }
  }

  console.log(`Found ${reviews.length} Google Play reviews in the last 1 week.`);
  return reviews;
}

export async function fetchAppStoreReviews(appId: string, country: string = 'us'): Promise<Review[]> {
  const cutoffDate = new Date(Date.now() - ONE_WEEK_MS);
  let page = 1;
  const reviews: Review[] = [];
  
  console.log(`Fetching Apple App Store reviews for ${appId}...`);
  // App store requires pagination (typically 1 to 10 pages maximum via API)
  while (page <= 10) {
    try {
      // app-store-scraper expects either `id` (numeric) or `appId` (bundle id).
      const scraperOpts: any = {
        sort: appStore.sort.RECENT,
        page: page,
        country: country
      };
      
      if (/^\d+$/.test(appId)) {
        scraperOpts.id = appId;
      } else {
        scraperOpts.appId = appId;
      }
      
      const rawReviews = await appStore.reviews(scraperOpts);

      if (!rawReviews || rawReviews.length === 0) {
        break;
      }

      for (const item of rawReviews) {
        // App store scraper returns updated/date
        // @ts-ignore - Handle potential schema variation in app-store-scraper
        const reviewDate = new Date(item.updated || item.date);
        
        // Stop paginating if we reach reviews older than our cutoff
        if (reviewDate < cutoffDate) {
          console.log(`Found ${reviews.length} Apple App Store reviews in the last 1 week.`);
          return reviews;
        }

        const title = item.title || '';
        const text = item.text || '';
        if (isReviewValid(title, text)) {
          reviews.push({
            source: 'Apple App Store',
            date: reviewDate,
            rating: item.score,
            title: title,
            text: text
          });
        }
      }
      page++;
    } catch (err) {
      console.warn(`Failed to fetch page ${page} from App Store:`, err);
      break;
    }
  }

  console.log(`Found ${reviews.length} Apple App Store reviews in the last 12 weeks.`);
  return reviews;
}

export async function fetchAllReviews(playStoreId: string, appStoreId: string, country: string = 'us'): Promise<Review[]> {
  const [playReviews, appReviews] = await Promise.all([
    fetchPlayStoreReviews(playStoreId, country).catch(err => {
      console.error('Failed to fetch Play Store reviews:', err);
      return [];
    }),
    fetchAppStoreReviews(appStoreId, country).catch(err => {
      console.error('Failed to fetch App Store reviews:', err);
      return [];
    })
  ]);
  
  // Merge and sort newest to oldest
  return [...playReviews, ...appReviews].sort((a, b) => b.date.getTime() - a.date.getTime());
}
