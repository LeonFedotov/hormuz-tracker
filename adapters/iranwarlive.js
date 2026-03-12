/**
 * IranWarLive.com conflict feed adapter.
 *
 * Fetches the full iranwarlive.com/feed.json — all geolocated conflict events
 * (not just Hormuz-filtered). Outputs to data/iranwarlive-events.json.
 *
 * This is the best free structured conflict data source available.
 * See research/conflict-events-sources.md for details.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  parseIranWarLiveItem as _parseItem,
  normalizeEvent as _normalizeEvent,
  deduplicateEvents,
  isInBoundingBox,
} from './liveuamap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'iranwarlive-events.json');

export const FEED_URL = 'https://iranwarlive.com/feed.json';

// Wider bounding box: all events in Iran/Gulf/Levant theater
export const ALL_EVENTS_BBOX = {
  minLat: 20,
  maxLat: 42,
  minLon: 30,
  maxLon: 65,
};

// Re-export shared functions for test access
export { _parseItem as parseIranWarLiveItem, _normalizeEvent as normalizeEvent };

/**
 * Parse full feed → filtered, normalized, deduplicated events.
 * Uses wider bounding box than liveuamap adapter (captures all theater events).
 */
export function parseFeed(feedJson) {
  const items = feedJson?.items ?? [];
  if (items.length === 0) return [];

  const parsed = items.map(_parseItem);
  const withCoords = parsed.filter((p) => p.lat != null && p.lon != null);
  const inArea = withCoords.filter((p) => isInBoundingBox(p.lat, p.lon, ALL_EVENTS_BBOX));
  const normalized = inArea.map(_normalizeEvent);
  return deduplicateEvents(normalized);
}

/** Fetch feed from iranwarlive.com */
export async function fetchFeed() {
  const result = execSync(
    `curl -sfS --max-time 10 --connect-timeout 5 "${FEED_URL}"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(result);
}

/** Main: fetch, parse, merge, write */
export async function run() {
  console.log('Fetching all conflict events from iranwarlive.com...');
  const feedJson = await fetchFeed();
  const newEvents = parseFeed(feedJson);
  console.log(`Parsed ${newEvents.length} theater events from feed`);

  let existing = [];
  if (existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
    } catch {
      existing = [];
    }
  }

  const merged = deduplicateEvents([...existing, ...newEvents]);
  merged.sort((a, b) => b.timestamp - a.timestamp);

  writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} total events to ${OUTPUT_FILE}`);
  return merged;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error('Failed to fetch conflict events:', err.message);
    process.exit(1);
  });
}
