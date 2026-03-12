/**
 * Conflict events adapter for the Hormuz Crisis Intelligence Platform.
 *
 * Primary source: iranwarlive.com/feed.json (structured OSINT conflict feed)
 * LiveUAMap's API is paid/obfuscated, so iranwarlive is used as the best
 * free structured alternative per research/conflict-events-sources.md.
 *
 * Output: data/liveuamap-events.json (normalized DataEvent array)
 */

import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'liveuamap-events.json');
const FEED_URL = 'https://iranwarlive.com/feed.json';

// ── Bounding box for Hormuz / Persian Gulf region ─────────────────
// Expanded slightly beyond strict Hormuz to capture Gulf events

export const HORMUZ_BBOX = {
  minLat: 22,
  maxLat: 32,
  minLon: 46,
  maxLon: 62,
};

// ── Event type mapping: iranwarlive → our schema ──────────────────

export const EVENT_TYPE_MAP = {
  'air strike': 'incident',
  'air attacks (israel-us)': 'incident',
  'us-israeli strikes': 'incident',
  'strike': 'incident',
  'reported israeli strike': 'incident',
  'interception of retaliatory strikes': 'military_sighting',
  'missile launch': 'military_sighting',
  'naval engagement': 'vessel_attack',
  'drone strike': 'incident',
  'explosion': 'incident',
  'infrastructure damage': 'infrastructure_damage',
  'mine report': 'mine_report',
  'oil spill': 'oil_spill',
};

// ── Confidence mapping ────────────────────────────────────────────

const CONFIDENCE_MAP = {
  'confirmed': 'verified',
  'verified': 'verified',
  'osint': 'medium',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
  'unverified': 'unverified',
};

// ── Helper functions ──────────────────────────────────────────────

function hashString(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

export function mapEventType(type) {
  if (!type) return 'incident';
  const lower = type.toLowerCase().trim();
  return EVENT_TYPE_MAP[lower] || 'incident';
}

export function mapConfidence(confidence) {
  if (!confidence) return 'low';
  const lower = confidence.toLowerCase().trim();
  return CONFIDENCE_MAP[lower] || 'low';
}

export function isInBoundingBox(lat, lon, bbox) {
  if (lat == null || lon == null) return false;
  return lat >= bbox.minLat && lat <= bbox.maxLat &&
         lon >= bbox.minLon && lon <= bbox.maxLon;
}

export function filterHormuzArea(events) {
  return events.filter((e) => isInBoundingBox(e.lat, e.lon, HORMUZ_BBOX));
}

// ── Parse a single iranwarlive feed item ──────────────────────────

export function parseIranWarLiveItem(item) {
  const coords = item._osint_meta?.coordinates;
  return {
    event_id: item.event_id || '',
    type: item.type || '',
    location: item.location || '',
    timestamp: new Date(item.timestamp),
    confidence: item.confidence || '',
    summary: item.event_summary || '',
    source_url: item.source_url || '',
    lat: coords?.lat ?? null,
    lon: coords?.lng ?? null,
    casualties: item._osint_meta?.casualties ?? 0,
  };
}

// ── Normalize parsed item to DataEvent schema ─────────────────────

export function normalizeEvent(parsed) {
  const eventType = mapEventType(parsed.type);
  const id = `liveuamap:${eventType}:${hashString(parsed.event_id || parsed.source_url || '')}`;
  const ts = parsed.timestamp instanceof Date && !isNaN(parsed.timestamp.getTime())
    ? parsed.timestamp.getTime()
    : 0;

  return {
    id,
    type: eventType,
    lat: parsed.lat,
    lon: parsed.lon,
    timestamp: ts,
    source: 'liveuamap',
    confidence: mapConfidence(parsed.confidence),
    title: `${parsed.type} — ${parsed.location}`,
    description: parsed.summary,
    url: parsed.source_url,
    data: {
      location: parsed.location,
      casualties: parsed.casualties,
      originalType: parsed.type,
      originalId: parsed.event_id,
    },
  };
}

// ── Deduplication ─────────────────────────────────────────────────

export function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// ── Parse full feed → filtered, normalized, deduplicated events ───

export function parseFeed(feedJson) {
  const items = feedJson?.items ?? [];
  if (items.length === 0) return [];

  const parsed = items.map(parseIranWarLiveItem);
  const withCoords = parsed.filter((p) => p.lat != null && p.lon != null);
  const inArea = withCoords.filter((p) => isInBoundingBox(p.lat, p.lon, HORMUZ_BBOX));
  const normalized = inArea.map(normalizeEvent);
  return deduplicateEvents(normalized);
}

// ── Fetch feed from iranwarlive.com ───────────────────────────────

export async function fetchFeed() {
  const result = execSync(
    `curl -sfS --max-time 10 --connect-timeout 5 "${FEED_URL}"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(result);
}

// ── Main: fetch, parse, merge, write ──────────────────────────────

export async function run() {
  console.log('Fetching conflict events from iranwarlive.com...');
  const feedJson = await fetchFeed();
  const newEvents = parseFeed(feedJson);
  console.log(`Parsed ${newEvents.length} Hormuz-area events from feed`);

  // Merge with existing events (if any)
  let existing = [];
  if (existsSync(OUTPUT_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
      existing = Array.isArray(parsed) ? parsed : (parsed.events || []);
    } catch {
      existing = [];
    }
  }

  const merged = deduplicateEvents([...existing, ...newEvents]);
  // Sort by timestamp descending (newest first)
  merged.sort((a, b) => b.timestamp - a.timestamp);

  writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} total events to ${OUTPUT_FILE}`);
  return merged;
}

// ── Liveuamap AJAX venue parsing ────────────────────────────────────
// liveuamap.com serves events as base64-encoded JSON via AJAX.
// Each "venue" has lat/lng, timestamp, icon (picpath), title, link, etc.

const PICPATH_TYPE_MAP = {
  bomb: 'incident',
  explode: 'incident',
  destroy: 'incident',
  rocket: 'incident',
  aa: 'incident',
  shahed: 'incident',
  fires: 'incident',
  dead: 'incident',
  ship: 'military_sighting',
  airplane: 'military_sighting',
  speech: 'news',
  phone: 'news',
  medicine: 'news',
  map: 'news',
  natural_resource: 'infrastructure_damage',
};

export function mapPicpathToType(picpath) {
  if (!picpath) return 'incident';
  const base = picpath.replace(/-\d+$/, '');
  return PICPATH_TYPE_MAP[base] || 'incident';
}

export function mapColorToConfidence(colorId) {
  // color_id 10 = red (active conflict), 11 = dark red
  // color_id 1 = blue (politics/diplomacy), 2 = green (military movement)
  if (colorId === 10 || colorId === 11) return 'medium';
  if (colorId === 1 || colorId === 2) return 'low';
  return 'low';
}

export function normalizeVenue(venue) {
  const lat = parseFloat(venue.lat);
  const lon = parseFloat(venue.lng);
  const type = mapPicpathToType(venue.picpath);
  const hash = hashString(String(venue.id));

  return {
    id: `liveuamap:${type}:${hash}`,
    type,
    lat: isNaN(lat) ? null : lat,
    lon: isNaN(lon) ? null : lon,
    timestamp: (venue.timestamp || 0) * 1000,
    source: 'liveuamap',
    confidence: mapColorToConfidence(venue.color_id),
    title: venue.name || '',
    description: venue.description || venue.udescription || '',
    url: venue.link || '',
    icon: venue.picpath,
    data: {
      liveuamapId: venue.id,
      location: venue.location || '',
      catId: venue.cat_id,
      colorId: venue.color_id,
      originalSource: venue.source || '',
      picpath: venue.picpath,
    },
  };
}

export function parseVenuesResponse(rawData) {
  let json;
  try {
    // AJAX response is base64-encoded
    const decoded = Buffer.from(rawData, 'base64').toString('utf-8');
    json = JSON.parse(decoded);
  } catch {
    try {
      // Might already be plain JSON
      json = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch {
      return { events: [], meta: {} };
    }
  }

  const venues = json?.venues || [];
  const events = venues
    .map(normalizeVenue)
    .filter((e) => e.lat != null && e.lon != null);

  return {
    events,
    meta: {
      globaltime: json.globaltime,
      total: json.amount,
      last: json.last,
    },
  };
}

// ── Extract session variables from liveuamap HTML ───────────────────

export function extractSessionVars(html) {
  const rainMatch = html.match(/var rain='([^']+)'/);
  const globaltimeMatch = html.match(/var globaltime\s*=\s*'(\d+)'/);
  if (!rainMatch || !globaltimeMatch) return null;
  return {
    rain: rainMatch[1],
    globaltime: globaltimeMatch[1],
  };
}

// ── Fetch from liveuamap.com AJAX ───────────────────────────────────

export async function fetchLiveuamap() {
  // Step 1: Fetch main page to extract session variables
  let html;
  try {
    html = execSync(
      'curl -sfS --max-time 10 --connect-timeout 5 "https://iran.liveuamap.com"',
      { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
    );
  } catch (err) {
    console.error('[liveuamap] Failed to fetch main page:', err.message);
    return { events: [], meta: { error: 'Failed to fetch main page' } };
  }

  const session = extractSessionVars(html);
  if (!session) {
    console.error('[liveuamap] Could not extract session variables');
    return { events: [], meta: { error: 'Session variables not found' } };
  }

  // Step 2: Fetch structured event data via AJAX
  const ajaxUrl = `https://iran.liveuamap.com/ajax/do?act=a${session.rain}&curid=0&time=${session.globaltime}&last=0`;
  let ajaxData;
  try {
    ajaxData = execSync(
      `curl -sfS --max-time 10 --connect-timeout 5 -H "X-Requested-With: XMLHttpRequest" -H "Referer: https://iran.liveuamap.com/" "${ajaxUrl}"`,
      { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 },
    );
  } catch (err) {
    console.error('[liveuamap] Failed to fetch AJAX data:', err.message);
    return { events: [], meta: { error: 'AJAX fetch failed' } };
  }

  return parseVenuesResponse(ajaxData);
}

// ── Main: fetch both sources, merge, save ───────────────────────────

export async function runLiveuamap({ hormuzOnly = true, save = true } = {}) {
  console.log('[liveuamap] Fetching events from iran.liveuamap.com...');

  const { events: allEvents, meta } = await fetchLiveuamap();

  if (allEvents.length === 0) {
    console.log('[liveuamap] No events fetched. Meta:', meta);
    return { events: [], meta };
  }

  console.log(`[liveuamap] Fetched ${allEvents.length} total events`);

  const events = hormuzOnly ? filterHormuzArea(allEvents) : allEvents;
  console.log(`[liveuamap] ${events.length} in Hormuz region (of ${allEvents.length} total)`);

  events.sort((a, b) => b.timestamp - a.timestamp);

  if (save) {
    const output = {
      _meta: {
        source: 'liveuamap',
        fetchedAt: new Date().toISOString(),
        totalFetched: allEvents.length,
        hormuzFiltered: events.length,
        globaltime: meta.globaltime,
      },
      events,
    };

    writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`[liveuamap] Saved ${events.length} events to ${OUTPUT_FILE}`);
  }

  return { events, meta };
}

// Run if executed directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url) ||
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const mode = process.argv.includes('--ajax') ? 'ajax' : 'feed';
  const allRegions = process.argv.includes('--all');

  if (mode === 'ajax') {
    runLiveuamap({ hormuzOnly: !allRegions }).then(({ events }) => {
      if (events.length > 0) {
        console.log(`\n${events.length} events:`);
        for (const e of events.slice(0, 10)) {
          console.log(`  [${e.type}] ${e.title}`);
          console.log(`    lat=${e.lat}, lon=${e.lon}, ${new Date(e.timestamp).toISOString()}`);
          console.log(`    ${e.url}\n`);
        }
      }
    }).catch((err) => {
      console.error('[liveuamap] Fatal:', err.message);
      process.exit(1);
    });
  } else {
    run().catch((err) => {
      console.error('Failed to fetch conflict events:', err.message);
      process.exit(1);
    });
  }
}
