/**
 * Data Aggregator — Runs all adapters, merges events, regenerates crisis score.
 *
 * Usage: node server/collect.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');

// ── Adapter definitions ───────────────────────────────────────────

const ADAPTERS = [
  { name: 'reddit', script: 'adapters/reddit.js', output: 'data/reddit-events.json' },
  { name: 'news-rss', script: 'adapters/news-rss.js', output: 'data/news-events.json' },
  { name: 'liveuamap', script: 'adapters/liveuamap.js', args: '--ajax', output: 'data/liveuamap-events.json' },
  { name: 'iranwarlive', script: 'adapters/iranwarlive.js', output: 'data/iranwarlive-events.json' },
];

const EVENT_FILES = [
  'data/reddit-events.json',
  'data/news-events.json',
  'data/liveuamap-events.json',
  'data/iranwarlive-events.json',
  'data/manual-events.json',
];

// ── Pure utility functions (exported for testing) ─────────────────

/**
 * Extract events array from a data file's parsed JSON.
 * Handles both {_meta, events} wrapper format and bare arrays.
 */
export function readEventFile(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.events)) return data.events;
  return [];
}

/**
 * Deduplicate events by id. Keeps first occurrence.
 * Events without an id are always kept.
 */
export function deduplicateById(events) {
  const seen = new Set();
  return events.filter((e) => {
    if (!e.id) return true;
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/**
 * Merge multiple event arrays, deduplicate, sort by timestamp descending.
 */
export function mergeAllEvents(sources) {
  const all = sources.flat();
  const deduped = deduplicateById(all);
  deduped.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return deduped;
}

// ── Runner functions ──────────────────────────────────────────────

function runAdapter(adapter) {
  const script = resolve(ROOT, adapter.script);
  const args = adapter.args || '';
  const cmd = `node "${script}" ${args}`.trim();

  console.log(`\n[${'='.repeat(50)}]`);
  console.log(`[collect] Running ${adapter.name}...`);

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    // Print adapter output indented
    for (const line of output.trim().split('\n')) {
      console.log(`  ${line}`);
    }
    return { name: adapter.name, success: true };
  } catch (err) {
    console.error(`  [${adapter.name}] FAILED: ${err.message.split('\n')[0]}`);
    return { name: adapter.name, success: false, error: err.message.split('\n')[0] };
  }
}

function loadAndMerge() {
  const allSources = [];
  const summary = [];

  for (const file of EVENT_FILES) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) {
      summary.push({ file, count: 0, status: 'missing' });
      continue;
    }

    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      const events = readEventFile(raw);
      allSources.push(events);
      summary.push({ file, count: events.length, status: 'ok' });
    } catch (err) {
      summary.push({ file, count: 0, status: `error: ${err.message}` });
    }
  }

  const merged = mergeAllEvents(allSources);
  return { merged, summary };
}

function runScoring() {
  const scoreScript = resolve(ROOT, 'scoring/score.js');
  console.log('\n[collect] Regenerating crisis score...');

  try {
    const output = execSync(`node "${scoreScript}"`, {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 15000,
    });
    for (const line of output.trim().split('\n')) {
      console.log(`  ${line}`);
    }
    return true;
  } catch (err) {
    console.error(`  [scoring] FAILED: ${err.message.split('\n')[0]}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('[collect] Hormuz Crisis Intelligence — Data Collection');
  console.log(`[collect] ${new Date().toISOString()}`);

  // 1. Run all adapters
  const adapterResults = ADAPTERS.map(runAdapter);

  // 2. Merge all event files
  console.log(`\n[${'='.repeat(50)}]`);
  console.log('[collect] Merging all event data...');
  const { merged, summary } = loadAndMerge();

  // Write merged events
  const allEventsPath = resolve(DATA_DIR, 'all-events.json');
  writeFileSync(allEventsPath, JSON.stringify(merged, null, 2));

  // 3. Regenerate crisis score
  const scoringOk = runScoring();

  // 4. Print summary
  console.log(`\n[${'='.repeat(50)}]`);
  console.log('[collect] SUMMARY');
  console.log('');

  console.log('  Adapters:');
  for (const r of adapterResults) {
    const icon = r.success ? '+' : 'x';
    console.log(`    [${icon}] ${r.name}${r.error ? ` — ${r.error}` : ''}`);
  }

  console.log('');
  console.log('  Event files:');
  let totalEvents = 0;
  for (const s of summary) {
    console.log(`    ${s.file}: ${s.count} events (${s.status})`);
    totalEvents += s.count;
  }

  console.log('');
  console.log(`  Total events (before dedup): ${totalEvents}`);
  console.log(`  Merged events (after dedup): ${merged.length}`);
  console.log(`  Written to: ${allEventsPath}`);
  console.log(`  Scoring: ${scoringOk ? 'OK' : 'FAILED'}`);

  const failures = adapterResults.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log(`\n  WARNING: ${failures.length} adapter(s) failed`);
  }

  console.log(`\n[collect] Done.`);
}

// Run if executed directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
