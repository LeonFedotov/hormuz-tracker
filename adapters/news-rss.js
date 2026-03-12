/**
 * News RSS adapter for the Hormuz Crisis Intelligence Platform.
 *
 * Fetches RSS/Atom feeds from major news sources, filters for
 * Strait of Hormuz relevance, and outputs normalized events.
 *
 * Usage:  node adapters/news-rss.js
 * Output: data/news-events.json
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Configuration ──────────────────────────────────────────────────

export const FEED_SOURCES = [
  {
    name: 'google_news',
    url: 'https://news.google.com/rss/search?q=strait+of+hormuz+2026&hl=en',
  },
  {
    name: 'reuters',
    url: 'https://www.reutersagency.com/feed/',
  },
  {
    name: 'al_jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
  },
  {
    name: 'bbc',
    url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
  },
  {
    name: 'lloyds_maritime',
    url: 'https://lloydslist.com/rss',
  },
];

export const RELEVANCE_KEYWORDS = [
  'hormuz',
  'iran',
  'strait',
  'gulf',
  'shipping',
  'tanker',
  'naval',
  'blockade',
  'oil',
];

// ── XML Parsing (regex-based, no deps) ─────────────────────────────

/**
 * Extract text content between XML tags. Returns empty string if not found.
 */
function extractTag(xml, tagName) {
  // Match <tag>...</tag> or <tag ...>...</tag>, non-greedy
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  // Strip CDATA wrappers
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/**
 * Extract href from Atom <link> tag.
 */
function extractAtomLink(entryXml) {
  // <link href="..." />  or  <link href="..."></link>  or  <link rel="alternate" href="..."/>
  const m = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : '';
}

/**
 * Parse RSS 2.0 or Atom XML into a flat array of article objects.
 * Returns: [{ title, link, description, pubDate }]
 */
export function parseRssXml(xml) {
  if (!xml || typeof xml !== 'string') return [];

  const items = [];

  // Try RSS 2.0 <item> blocks
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link') || extractAtomLink(block),
      description: extractTag(block, 'description') || extractTag(block, 'summary'),
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated'),
    });
  }

  // Try Atom <entry> blocks (if no RSS items found)
  if (items.length === 0) {
    const atomEntryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = atomEntryRegex.exec(xml)) !== null) {
      const block = match[1];
      items.push({
        title: extractTag(block, 'title'),
        link: extractAtomLink(block) || extractTag(block, 'link'),
        description: extractTag(block, 'summary') || extractTag(block, 'content'),
        pubDate: extractTag(block, 'updated') || extractTag(block, 'published'),
      });
    }
  }

  return items;
}

// ── Relevance Filtering ────────────────────────────────────────────

/**
 * Check if an article is relevant to the Hormuz crisis.
 * Matches any keyword in title or description (case-insensitive).
 */
export function isRelevant(article) {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));
}

// ── Hashing ────────────────────────────────────────────────────────

/**
 * Produce a short deterministic hex hash from a string (URL or title).
 */
export function hashArticle(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

// ── Event Normalization ────────────────────────────────────────────

/**
 * Convert a parsed article into a normalized DataEvent.
 */
export function normalizeEvent(article, feedSourceName) {
  const ts = Date.parse(article.pubDate);
  return {
    id: `news:${feedSourceName}:${hashArticle(article.link || article.title)}`,
    type: 'news',
    lat: null,
    lon: null,
    timestamp: Number.isNaN(ts) ? 0 : ts,
    source: 'news_rss',
    confidence: 'high',
    title: article.title || '',
    description: article.description || '',
    url: article.link || '',
    data: { feedSource: feedSourceName },
  };
}

// ── Deduplication ──────────────────────────────────────────────────

/**
 * Remove duplicate events by id, keeping the first occurrence.
 */
export function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// ── Feed Fetching (curl) ───────────────────────────────────────────

/**
 * Fetch a URL using curl. Returns the body string, or null on failure.
 */
function fetchFeed(url) {
  try {
    const result = execSync(
      `curl -sfS --max-time 10 --connect-timeout 5 "${url}"`,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024, timeout: 15000 }
    );
    return result;
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(__dirname, '..', 'data', 'news-events.json');

  console.log('Hormuz News RSS Adapter');
  console.log('=======================\n');

  const allEvents = [];

  for (const feed of FEED_SOURCES) {
    process.stdout.write(`Fetching ${feed.name} (${feed.url}) ... `);
    const xml = fetchFeed(feed.url);
    if (!xml) {
      console.log('FAILED (fetch error)');
      continue;
    }

    const items = parseRssXml(xml);
    console.log(`${items.length} items`);

    const relevant = items.filter(isRelevant);
    console.log(`  -> ${relevant.length} relevant articles`);

    const events = relevant.map((a) => normalizeEvent(a, feed.name));
    allEvents.push(...events);
  }

  const deduped = deduplicateEvents(allEvents);

  console.log(`\nTotal: ${deduped.length} unique relevant events`);

  // Ensure data directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const output = {
    _meta: {
      adapter: 'news-rss',
      fetchedAt: new Date().toISOString(),
      feedCount: FEED_SOURCES.length,
      eventCount: deduped.length,
    },
    events: deduped,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`Written to ${outputPath}`);
}

// Run main only when executed directly (not imported by tests)
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
