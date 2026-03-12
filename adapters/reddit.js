/**
 * Reddit data adapter for Hormuz Crisis Intelligence Platform.
 *
 * Fetches recent posts from defense/geopolitics subreddits about the
 * Strait of Hormuz crisis using Reddit's public JSON API (no auth).
 * Normalizes posts into the platform's DataEvent schema and saves
 * to data/reddit-events.json.
 *
 * Usage:  node adapters/reddit.js
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const OUTPUT_FILE = resolve(DATA_DIR, 'reddit-events.json');

const USER_AGENT = 'hormuz-tracker/1.0 (crisis-intelligence; +https://github.com/hormuz-tracker)';

// ---------------------------------------------------------------------------
// Constants (exported for testing)
// ---------------------------------------------------------------------------

export const SUBREDDIT_URLS = [
  'https://old.reddit.com/r/CredibleDefense/search.json?q=hormuz+OR+iran+OR+strait&sort=new&t=week&limit=25&restrict_sr=on',
  'https://old.reddit.com/r/geopolitics/search.json?q=hormuz+OR+iran+OR+shipping+OR+strait&sort=new&t=week&limit=25&restrict_sr=on',
  'https://old.reddit.com/r/OSINT/search.json?q=hormuz+OR+iran+OR+naval+OR+ais&sort=new&t=week&limit=25&restrict_sr=on',
  'https://old.reddit.com/r/CombatFootage/search.json?q=iran+OR+hormuz+OR+gulf&sort=new&t=week&limit=25&restrict_sr=on',
  'https://old.reddit.com/r/worldnews/search.json?q=hormuz+OR+iran+OR+strait+OR+gulf+blockade&sort=new&t=week&limit=25&restrict_sr=on',
];

export const INCIDENT_KEYWORDS = [
  'strike',
  'strikes',
  'struck',
  'attack',
  'attacked',
  'attacks',
  'bombing',
  'bombed',
  'bomb',
  'missile',
  'missiles',
  'torpedo',
  'torpedoed',
  'ship attack',
  'ship seized',
  'tanker attacked',
  'tanker seized',
  'military movement',
  'naval engagement',
  'drone strike',
  'explosion',
  'mine',
  'mines',
  'sunk',
  'sinking',
  'infrastructure damage',
  'destroyed',
  'blockade',
  'warning shots',
  'fired',
  'shelling',
  'airstrike',
  'airstrikes',
  'intercept',
  'intercepted',
  'seized',
  'hijacked',
  'boarding',
  'casualties',
  'killed',
  'wounded',
];

/**
 * Known location patterns with approximate coordinates.
 * Used to geo-tag Reddit posts that mention recognizable locations.
 */
export const LOCATION_PATTERNS = [
  { pattern: /strait\s+of\s+hormuz/i, lat: 26.56, lon: 56.25, name: 'Strait of Hormuz' },
  { pattern: /\bhormuz\b/i, lat: 26.56, lon: 56.25, name: 'Strait of Hormuz' },
  { pattern: /bandar\s+abbas/i, lat: 27.18, lon: 56.28, name: 'Bandar Abbas' },
  { pattern: /kharg\s+island/i, lat: 29.23, lon: 50.32, name: 'Kharg Island' },
  { pattern: /ras\s+tanura/i, lat: 26.64, lon: 50.17, name: 'Ras Tanura' },
  { pattern: /ras\s+laffan/i, lat: 25.37, lon: 51.15, name: 'Ras Laffan' },
  { pattern: /fujairah/i, lat: 25.12, lon: 56.33, name: 'Fujairah' },
  { pattern: /jask/i, lat: 25.65, lon: 57.77, name: 'Jask' },
  { pattern: /lavan\s+island/i, lat: 26.80, lon: 53.36, name: 'Lavan Island' },
  { pattern: /sirri\s+island/i, lat: 25.89, lon: 54.55, name: 'Sirri Island' },
  { pattern: /abadan/i, lat: 30.34, lon: 48.28, name: 'Abadan' },
  { pattern: /assaluyeh/i, lat: 27.47, lon: 52.61, name: 'Assaluyeh' },
  { pattern: /south\s+pars/i, lat: 27.47, lon: 52.61, name: 'South Pars' },
  { pattern: /persian\s+gulf/i, lat: 26.0, lon: 52.0, name: 'Persian Gulf' },
  { pattern: /gulf\s+of\s+oman/i, lat: 24.5, lon: 58.5, name: 'Gulf of Oman' },
  { pattern: /muscat/i, lat: 23.59, lon: 58.54, name: 'Muscat' },
  { pattern: /chabahar/i, lat: 25.29, lon: 60.64, name: 'Chabahar' },
  { pattern: /bushehr/i, lat: 28.97, lon: 50.84, name: 'Bushehr' },
  { pattern: /qeshm/i, lat: 26.95, lon: 56.27, name: 'Qeshm Island' },
  { pattern: /abu\s+musa/i, lat: 25.88, lon: 55.03, name: 'Abu Musa Island' },
];

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a Reddit post as 'incident' or 'news'.
 * Checks title and selftext against incident keywords.
 */
export function classifyPost(post) {
  const text = `${post.title || ''} ${post.selftext || ''}`.toLowerCase();
  for (const kw of INCIDENT_KEYWORDS) {
    // Match whole-word (or close) to avoid false positives on substrings
    if (text.includes(kw.toLowerCase())) {
      return 'incident';
    }
  }
  return 'news';
}

// ---------------------------------------------------------------------------
// Location extraction
// ---------------------------------------------------------------------------

/**
 * Try to extract a geographic location from text.
 * Returns { lat, lon, name } or null.
 */
export function extractLocationMention(text) {
  if (!text) return null;
  for (const loc of LOCATION_PATTERNS) {
    if (loc.pattern.test(text)) {
      return { lat: loc.lat, lon: loc.lon, name: loc.name };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Convert a raw Reddit post object into a normalized DataEvent.
 */
export function normalizePost(post) {
  const combinedText = `${post.title || ''} ${post.selftext || ''}`;
  const location = extractLocationMention(combinedText);

  return {
    id: `reddit:${post.id}`,
    type: classifyPost(post),
    lat: location ? location.lat : null,
    lon: location ? location.lon : null,
    timestamp: post.created_utc * 1000,
    source: 'reddit',
    confidence: 'low',
    title: post.title,
    description: (post.selftext || '').slice(0, 500),
    url: `https://reddit.com${post.permalink}`,
    data: {
      subreddit: post.subreddit,
      score: post.score,
      num_comments: post.num_comments,
    },
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Remove duplicate posts (same id). Keeps the first occurrence.
 */
export function deduplicatePosts(posts) {
  const seen = new Set();
  const result = [];
  for (const post of posts) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      result.push(post);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch posts from a single subreddit search URL using curl.
 * Returns an array of raw post data objects.
 */
export function fetchSubreddit(url) {
  try {
    const stdout = execSync(
      `curl -sfS --max-time 10 --connect-timeout 5 -H "User-Agent: ${USER_AGENT}" "${url}"`,
      { encoding: 'utf-8', timeout: 15000 }
    );
    const json = JSON.parse(stdout);
    const children = json?.data?.children;
    if (!Array.isArray(children)) return [];
    return children.map((c) => c.data).filter(Boolean);
  } catch (err) {
    const sub = url.match(/\/r\/(\w+)\//)?.[1] || 'unknown';
    console.error(`[reddit] Failed to fetch r/${sub}: ${err.message}`);
    return [];
  }
}

/**
 * Fetch posts from all configured subreddits sequentially
 * (respects Reddit rate limiting).
 * Returns deduplicated array of raw post data.
 */
export function fetchAllSubreddits() {
  const allPosts = [];
  for (const url of SUBREDDIT_URLS) {
    const posts = fetchSubreddit(url);
    allPosts.push(...posts);
    // Small delay between requests to be polite to Reddit
  }
  return deduplicatePosts(allPosts);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('[reddit] Fetching posts from', SUBREDDIT_URLS.length, 'subreddits...');

  const rawPosts = fetchAllSubreddits();
  console.log(`[reddit] Got ${rawPosts.length} unique posts`);

  const events = rawPosts.map(normalizePost);
  const incidents = events.filter((e) => e.type === 'incident');
  const withLocation = events.filter((e) => e.lat !== null);

  console.log(`[reddit] Classified: ${incidents.length} incidents, ${events.length - incidents.length} news`);
  console.log(`[reddit] ${withLocation.length} posts geo-tagged with approximate locations`);

  // Ensure data directory exists
  mkdirSync(DATA_DIR, { recursive: true });

  const output = {
    _meta: {
      source: 'reddit',
      fetchedAt: new Date().toISOString(),
      subreddits: SUBREDDIT_URLS.map((u) => u.match(/\/r\/(\w+)\//)?.[1]).filter(Boolean),
      totalPosts: events.length,
      incidents: incidents.length,
      geoTagged: withLocation.length,
    },
    events,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`[reddit] Saved ${events.length} events to ${OUTPUT_FILE}`);
}

// Run when executed directly
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
