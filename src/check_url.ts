import * as fs from 'node:fs/promises';

async function check() {
  const url = 'https://itunes.apple.com/us/rss/customerreviews/page=1/id=310633997/sortby=mostrecent/json';
  console.log('Fetching', url);
  const res = await fetch(url);
  const json = await res.json();
  await fs.writeFile('apple_rss.json', JSON.stringify(json, null, 2));
  console.log('Saved to apple_rss.json, total entries:', json?.feed?.entry?.length);
}
check();
