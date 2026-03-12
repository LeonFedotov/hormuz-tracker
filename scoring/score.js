/**
 * Hormuz Crisis Intelligence Platform — Scoring Engine
 *
 * Computes crisis scores from ship position data and incident events.
 * Data format: ship-positions.json — array of objects with fields:
 *   mmsi, lat, lon, speed_kn, course, heading, name, ship_type,
 *   destination, flag, timestamp, source, ship_type_name
 * Speed is in knots.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Strait of Hormuz bounding box ----
const STRAIT = { latMin: 25.5, latMax: 27, lonMin: 55.5, lonMax: 57 };

// ---- Baselines ----
const TRANSIT_BASELINE = 153;  // ~153 vessel transits/day (research baseline)
const TANKER_BASELINE = 35;    // ~30-40 oil tankers transit daily

// ---- Parse ship-positions.json objects into normalized objects ----

export function parseShipData(raw) {
  return raw.map(r => ({
    lat: Number(r.lat) || 0,
    lon: Number(r.lon) || 0,
    spd: Number(r.speed_kn) || 0,
    cog: Number(r.course) || 0,
    heading: Number(r.heading) || 0,
    dest: (r.destination || '').trim(),
    flag: (r.flag || '').trim(),
    length: Number(r.length) || 0,
    name: (r.name || '').trim(),
    shiptype: Number(r.ship_type_code) || 0,
    id: r.mmsi || '',
    width: Number(r.width) || 0,
    dwt: Number(r.dwt) || 0,
    typeName: (r.ship_type || '').trim(),
  }));
}

// ---- Helper: is ship in the Strait zone? ----

function inStrait(s) {
  return s.lat > STRAIT.latMin && s.lat < STRAIT.latMax
      && s.lon > STRAIT.lonMin && s.lon < STRAIT.lonMax;
}

// ---- 1. Transit Score (0-100) ----

export function transitScore(ships) {
  const straitShips = ships.filter(inStrait);
  const moving = straitShips.filter(s => s.spd > 0.5);
  const score = Math.min(100, Math.round(moving.length / TRANSIT_BASELINE * 100));
  return {
    score,
    inZone: straitShips.length,
    moving: moving.length,
    baseline: TRANSIT_BASELINE,
  };
}

// ---- 2. Flow Balance Score ----
// In the Strait of Hormuz:
//   Inbound (into the Gulf) = roughly NW, course 270-360 or 0-30
//   Outbound (out of Gulf)  = roughly SE, course 90-210

function isInbound(cog) {
  return (cog >= 270 && cog <= 360) || (cog >= 0 && cog <= 30);
}

function isOutbound(cog) {
  return cog >= 90 && cog <= 210;
}

export function flowBalance(ships) {
  const straitMoving = ships.filter(s => inStrait(s) && s.spd > 0.5);

  const inbound = straitMoving.filter(s => isInbound(s.cog)).length;
  const outbound = straitMoving.filter(s => isOutbound(s.cog)).length;

  if (inbound === 0 && outbound === 0) {
    return { score: 0, inbound: 0, outbound: 0, ratio: '0:0' };
  }

  const total = inbound + outbound;
  const max = Math.max(inbound, outbound);
  const min = Math.min(inbound, outbound);

  // Perfect balance = 1.0, total imbalance = 0.0
  // Score = min/max * 100
  const balanceRatio = total > 0 ? min / max : 0;
  const score = Math.round(balanceRatio * 100);

  // Simplify ratio
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const g = gcd(inbound, outbound) || 1;
  const ratio = `${inbound / g}:${outbound / g}`;

  return { score, inbound, outbound, ratio };
}

// ---- 3. Stranded Vessel Score ----

// Destinations that don't indicate a real port/stranding
const IGNORE_DEST = new Set(['CLASS B', 'ORDERS', 'FOR ORDER', 'FOR ORDERS', 'ORDER', 'TBN', 'N/A', '']);

export function strandedScore(ships) {
  // Ships with a real destination set but speed = 0
  const stranded = ships.filter(s => s.dest && s.spd === 0 && !IGNORE_DEST.has(s.dest.toUpperCase()));
  const count = stranded.length;
  const dwt = stranded.reduce((sum, s) => sum + s.dwt, 0);

  // Score: fewer stranded = better. 0 stranded = 100, 100+ stranded = 0
  // Use a sigmoid-like curve: score = max(0, 100 - count * 1.25)
  const score = Math.max(0, Math.round(100 - count * 1.25));

  return { score, count, dwt };
}

// ---- 4. Tanker Traffic Score ----

export function tankerScore(ships) {
  const tankers = ships.filter(s => inStrait(s) && s.shiptype === 8);
  const moving = tankers.filter(s => s.spd > 0.5);
  const score = Math.min(100, Math.round(moving.length / TANKER_BASELINE * 100));

  return {
    score,
    count: tankers.length,
    moving: moving.length,
    baseline: TANKER_BASELINE,
  };
}

// ---- 5. Overall Crisis Score ----

const LABELS = [
  { max: 20, label: 'CRITICAL' },
  { max: 40, label: 'SEVERE' },
  { max: 60, label: 'HIGH' },
  { max: 80, label: 'ELEVATED' },
  { max: Infinity, label: 'NORMAL' },
];

const DESCRIPTIONS = {
  CRITICAL: 'Maritime traffic through Hormuz has effectively ceased. Potential full blockade.',
  SEVERE: 'Traffic through Hormuz is severely disrupted. Major shipping delays and diversions.',
  HIGH: 'Significant disruption to Hormuz traffic. Elevated risk for transiting vessels.',
  ELEVATED: 'Some disruption detected. Traffic below normal with elevated caution.',
  NORMAL: 'Maritime traffic through the Strait of Hormuz is within normal parameters.',
};

export function crisisScore(transit, flow, stranded, tanker, incidentCount = 0) {
  // Weighted composite
  const weights = { transit: 0.30, flow: 0.20, stranded: 0.20, tanker: 0.30 };

  let overall = Math.round(
    transit.score * weights.transit +
    flow.score * weights.flow +
    stranded.score * weights.stranded +
    tanker.score * weights.tanker
  );

  // Incident penalty: each incident reduces score by 5 points, max 30 penalty
  const incidentPenalty = Math.min(30, incidentCount * 5);
  overall = Math.max(0, overall - incidentPenalty);

  const { label } = LABELS.find(l => overall < l.max) || LABELS[LABELS.length - 1];

  return {
    overall,
    label,
    components: {
      transit: transit.score,
      flow: flow.score,
      stranded: stranded.score,
      tanker: tanker.score,
      incidentPenalty,
    },
  };
}

// ---- 6. Generate full report ----

const INCIDENT_TYPES = new Set([
  'incident', 'vessel_attack', 'mine_report', 'oil_spill',
  'infrastructure_damage', 'military_sighting',
]);

export function generateReport(ships, events = []) {
  const incidentCount = events.filter(e => INCIDENT_TYPES.has(e.type)).length;

  const transit = transitScore(ships);
  const flow = flowBalance(ships);
  const stranded = strandedScore(ships);
  const tankers = tankerScore(ships);
  const crisis = crisisScore(transit, flow, stranded, tankers, incidentCount);

  // Determine confidence based on data freshness / completeness
  const totalShips = ships.length;
  let confidence = 'low';
  if (totalShips > 1000) confidence = 'high';
  else if (totalShips > 200) confidence = 'medium';

  const summary = `Traffic through Hormuz is at ~${transit.score}% of normal levels. ` +
    `${transit.moving} of ${transit.inZone} ships in the strait zone are moving. ` +
    `Flow balance: ${flow.inbound} inbound vs ${flow.outbound} outbound (${flow.ratio}). ` +
    `${stranded.count} vessels appear stranded (${(stranded.dwt / 1000).toFixed(0)}k DWT). ` +
    `${tankers.moving} of ${tankers.count} tankers transiting (baseline: ${tankers.baseline}). ` +
    `Overall crisis level: ${crisis.label}.`;

  return {
    timestamp: new Date().toISOString(),
    overall: {
      score: crisis.overall,
      label: crisis.label,
      description: DESCRIPTIONS[crisis.label],
    },
    transit: {
      score: transit.score,
      inZone: transit.inZone,
      moving: transit.moving,
      baseline: transit.baseline,
    },
    flow: {
      score: flow.score,
      inbound: flow.inbound,
      outbound: flow.outbound,
      ratio: flow.ratio,
    },
    stranded: {
      score: stranded.score,
      count: stranded.count,
      totalDwt: stranded.dwt,
    },
    tankers: {
      score: tankers.score,
      count: tankers.count,
      moving: tankers.moving,
      baseline: tankers.baseline,
    },
    confidence,
    summary,
  };
}

// ---- CLI: read ship_data.js + events, write report ----

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main() {
  const projectRoot = resolve(__dirname, '..');

  // Read ship data
  const shipDataPath = resolve(projectRoot, 'data', 'ship-positions.json');
  const raw = JSON.parse(readFileSync(shipDataPath, 'utf8'));
  const ships = parseShipData(raw);
  console.log(`Loaded ${ships.length} ships from ship-positions.json`);

  // Read events — try conflict-events.json first, fall back to manual-events.json
  let events = [];
  for (const evFile of ['conflict-events.json', 'manual-events.json']) {
    try {
      const eventsPath = resolve(projectRoot, 'data', evFile);
      const eventsRaw = JSON.parse(readFileSync(eventsPath, 'utf8'));
      events = eventsRaw.events || (Array.isArray(eventsRaw) ? eventsRaw : []);
      console.log(`Loaded ${events.length} events from ${evFile}`);
      break;
    } catch {
      // try next file
    }
  }
  if (events.length === 0) {
    console.log('No events file found, proceeding without events');
  }

  // Generate report
  const report = generateReport(ships, events);

  // Write output
  const outDir = resolve(projectRoot, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'crisis-score.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nCrisis Score Report written to ${outPath}`);
  console.log(`\n  Overall: ${report.overall.score}/100 — ${report.overall.label}`);
  console.log(`  ${report.overall.description}`);
  console.log(`\n  Transit:  ${report.transit.score}/100 (${report.transit.moving}/${report.transit.inZone} ships moving in zone)`);
  console.log(`  Flow:     ${report.flow.score}/100 (${report.flow.inbound} in / ${report.flow.outbound} out, ratio ${report.flow.ratio})`);
  console.log(`  Stranded: ${report.stranded.score}/100 (${report.stranded.count} vessels, ${(report.stranded.totalDwt / 1000).toFixed(0)}k DWT)`);
  console.log(`  Tankers:  ${report.tankers.score}/100 (${report.tankers.moving}/${report.tankers.count} moving, baseline ${report.tankers.baseline})`);
  console.log(`\n  Confidence: ${report.confidence}`);
  console.log(`  Summary: ${report.summary}`);
}

// Run main when executed directly
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
