/**
 * Merge all conflict event sources into data/conflict-events.json.
 *
 * Sources:
 * 1. data/liveuamap-events.json (liveuamap AJAX adapter)
 * 2. data/iranwarlive-events.json (iranwarlive feed adapter)
 * 3. Wikipedia timeline events (hardcoded from research)
 *
 * Deduplicates by title similarity and outputs unified file.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWikipediaEvents } from './wikipedia-events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function loadJson(filepath) {
  if (!existsSync(filepath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filepath, 'utf8'));
    // Handle both array and {events: []} shapes
    if (Array.isArray(raw)) return raw;
    if (raw.events && Array.isArray(raw.events)) return raw.events;
    return [];
  } catch {
    return [];
  }
}

/**
 * Simple title similarity check for deduplication.
 * Returns true if titles are similar enough to be duplicates.
 */
function titlesSimilar(a, b) {
  if (!a || !b) return false;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Check if one contains the other (for partial matches)
  if (na.length > 20 && nb.length > 20) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

/**
 * Deduplicate events by id, then by title similarity within
 * a 24-hour time window.
 */
function deduplicateEvents(events) {
  const byId = new Map();
  for (const e of events) {
    if (!byId.has(e.id)) {
      byId.set(e.id, e);
    }
  }
  const unique = [...byId.values()];

  // Second pass: title similarity within 24h window
  const result = [];
  for (const event of unique) {
    const isDupe = result.some(
      (existing) =>
        titlesSimilar(existing.title, event.title) &&
        Math.abs(existing.timestamp - event.timestamp) < 24 * 60 * 60 * 1000,
    );
    if (!isDupe) {
      result.push(event);
    }
  }
  return result;
}

export function merge() {
  console.log('Merging conflict events from all sources...\n');

  // Load adapter outputs
  const liveuamap = loadJson(join(DATA_DIR, 'liveuamap-events.json'));
  console.log(`  liveuamap: ${liveuamap.length} events`);

  const iranwarlive = loadJson(join(DATA_DIR, 'iranwarlive-events.json'));
  console.log(`  iranwarlive: ${iranwarlive.length} events`);

  // Wikipedia timeline
  const wikipedia = getWikipediaEvents();
  console.log(`  wikipedia: ${wikipedia.length} events`);

  // Merge all sources
  const all = [...liveuamap, ...iranwarlive, ...wikipedia];
  console.log(`\n  Total before dedup: ${all.length}`);

  const merged = deduplicateEvents(all);
  // Sort by timestamp descending
  merged.sort((a, b) => b.timestamp - a.timestamp);
  console.log(`  Total after dedup: ${merged.length}`);

  // Count by source
  const bySrc = {};
  for (const e of merged) {
    bySrc[e.source] = (bySrc[e.source] || 0) + 1;
  }
  console.log('  By source:', bySrc);

  // Count by type
  const byType = {};
  for (const e of merged) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  console.log('  By type:', byType);

  // Write output
  const output = {
    _meta: {
      generated: new Date().toISOString(),
      sources: ['liveuamap', 'iranwarlive', 'wikipedia'],
      total: merged.length,
      bySource: bySrc,
      byType: byType,
    },
    events: merged,
  };

  const outPath = join(DATA_DIR, 'conflict-events.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${merged.length} events to ${outPath}`);
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  merge();
}
