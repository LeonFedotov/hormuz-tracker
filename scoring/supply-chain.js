/**
 * Hormuz Crisis Intelligence Platform — Supply Chain Impact Analysis
 *
 * Analyzes downstream supply chain impacts based on the crisis score
 * and research data from research/supply-chain-impacts.md.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Baselines from research ----

const OIL_BASELINE = 20;       // M bbl/day through Hormuz
const OIL_BYPASS = 2.6;        // M bbl/day (Fujairah + Yanbu pipelines actual)
const LNG_BASELINE = 110;      // bcm/year
const UREA_SHARE = 0.49;       // Gulf share of global urea exports
const AMMONIA_SHARE = 0.30;    // Gulf share of global ammonia exports
const SULFUR_SHARE = 0.50;     // Gulf share of global seaborne sulfur trade

// ---- 1. Oil Disruption ----

export function computeOilDisruption(crisis) {
  const tankerRatio = crisis.tankers.moving / crisis.tankers.baseline;
  const throughStrait = Math.min(1, tankerRatio) * OIL_BASELINE;
  const totalFlow = Math.min(OIL_BASELINE, throughStrait + OIL_BYPASS);
  const disruption = Math.round((1 - totalFlow / OIL_BASELINE) * 100);

  return {
    name: 'Crude Oil & Petroleum',
    baseline_flow: '20M bbl/day',
    current_estimate: `${totalFlow.toFixed(1)}M bbl/day`,
    disruption_pct: Math.max(0, disruption),
    bypass_capacity: '2.6M bbl/day',
    days_to_critical: disruption > 50 ? 7 : 30,
    downstream_impacts: [
      'Global oil prices surge (Brent >$100/bbl)',
      'Refinery throughput cuts in Asia and Europe',
      'Strategic petroleum reserve drawdowns',
      'Aviation fuel costs +33%',
    ],
  };
}

// ---- 2. LNG Disruption ----

export function computeLngDisruption(crisis) {
  const transitRatio = crisis.transit.moving / crisis.transit.baseline;
  // Qatar production halted since March 2-3 — even with some transit,
  // supply-side is near-zero. LNG disruption tracks transit but is worse
  // because Qatar (93% of Hormuz LNG) halted production at source.
  const qatarHaltFactor = 0.95; // 95% of Hormuz LNG is Qatar, which halted
  const effectiveTransit = transitRatio * (1 - qatarHaltFactor);
  const disruption = Math.round((1 - effectiveTransit) * 100);

  return {
    name: 'Liquefied Natural Gas (LNG)',
    baseline_flow: '110 bcm/year',
    current_estimate: `${(LNG_BASELINE * effectiveTransit).toFixed(1)} bcm/year`,
    disruption_pct: Math.min(100, Math.max(0, disruption)),
    days_to_critical: 14,
    notes: 'Qatar halted all LNG production at Ras Laffan after Iranian drone attack (March 2-3). ~93% of Hormuz LNG is Qatari.',
    downstream_impacts: [
      'Taiwan power generation at risk (Qatar = ~30% of Taiwan LNG)',
      'European gas storage crisis (46 bcm vs 77 bcm normal; TTF +76%)',
      'India exposed (60% of gas via Hormuz)',
      'Pakistan critical (99% of LNG from Qatar+UAE)',
      'South Korea industrial curtailment risk',
    ],
  };
}

// ---- 3. Petrochemicals Disruption ----

export function computePetrochemDisruption(crisis) {
  const transitRatio = crisis.transit.moving / crisis.transit.baseline;
  const disruption = Math.round((1 - Math.min(1, transitRatio)) * 100);

  return {
    name: 'Petrochemicals',
    baseline_flow: 'Multiple commodities',
    current_estimate: `~${Math.round(transitRatio * 100)}% of normal flow`,
    disruption_pct: Math.max(0, disruption),
    days_to_critical: 21,
    sub_commodities: [
      { name: 'sulfur', global_share: '50%', notes: 'Critical for sulfuric acid → semiconductor manufacturing' },
      { name: 'urea', global_share: '49%', notes: 'Spring planting season — immediate agricultural impact' },
      { name: 'ammonia', global_share: '30%', notes: 'Key fertilizer feedstock' },
      { name: 'methanol', global_share: 'significant', notes: 'QatarEnergy methanol production halted' },
      { name: 'ethylene', global_share: 'major', notes: 'Qatar JV polymer production halted' },
    ],
    downstream_impacts: [
      'Fertilizer prices surge +35% (urea at 3-year highs)',
      'Spring planting disrupted globally (Brazil, India, US)',
      'Sulfuric acid supply chain → semiconductor risk',
      'Chemical industry feedstock shortages',
    ],
  };
}

// ---- 4. Semiconductor Supply Chain ----

export function computeSemiDisruption(crisis) {
  const transitRatio = crisis.transit.moving / crisis.transit.baseline;

  // Two pathways: chemical (sulfur → sulfuric acid, 30-60 day stockpile)
  // and energy (LNG → power → TSMC, more acute)
  const chemicalDays = Math.round(30 + transitRatio * 30); // 30-60 range
  const energyDays = transitRatio < 0.2 ? 14 : 30;
  const daysToImpact = Math.min(chemicalDays, energyDays);

  return {
    name: 'Semiconductors',
    baseline_flow: 'Indirect dependency',
    current_estimate: transitRatio < 0.3 ? 'At risk' : 'Monitoring',
    disruption_pct: Math.round((1 - Math.min(1, transitRatio)) * 0.6 * 100), // indirect, scaled 60%
    days_to_critical: daysToImpact,
    pathways: [
      { name: 'Chemical stockpile', chain: 'Gulf sulfur → sulfuric acid → wafer cleaning/etching', stockpile_days: '30-60', status: 'drawing down' },
      { name: 'Energy (TSMC)', chain: 'Qatar LNG → Taiwan power → TSMC fabs', risk: 'Qatar = ~30% of Taiwan LNG imports', status: 'acute' },
    ],
    downstream_impacts: [
      'TSMC fab operations at risk from power shortages (LNG pathway)',
      'Electronic-grade sulfuric acid stockpile depleting (30-60 days)',
      'TSMC accelerating Arizona fab as strategic hedge',
    ],
  };
}

// ---- 5. Days-to-Impact Calculator ----

export function computeDaysToImpact(crisis) {
  const transitRatio = crisis.transit.moving / crisis.transit.baseline;
  const tankerRatio = crisis.tankers.moving / crisis.tankers.baseline;

  return [
    {
      chain: 'TSMC / Semiconductor Power',
      days: transitRatio < 0.2 ? 14 : transitRatio < 0.5 ? 21 : 45,
      severity: transitRatio < 0.3 ? 'CRITICAL' : 'HIGH',
      notes: 'Qatar LNG → Taiwan power → TSMC. 30% of Taiwan LNG from Qatar.',
    },
    {
      chain: 'European Gas Storage',
      days: 21,
      severity: 'HIGH',
      notes: 'Storage at 46 bcm (vs 77 normal). TTF +76%. 10% of LNG imports via Hormuz.',
    },
    {
      chain: 'Fertilizer / Spring Planting',
      days: transitRatio < 0.3 ? 7 : 14,
      severity: 'CRITICAL',
      notes: 'Northern Hemisphere spring planting NOW. 49% of global urea exports via Hormuz.',
    },
    {
      chain: 'Gulf Food Imports',
      days: 10,
      severity: 'CRITICAL',
      notes: 'Dubai has ~10 days fresh food supply. GCC imports 85% of food, 70%+ via Hormuz.',
    },
    {
      chain: 'Aviation Fuel',
      days: tankerRatio < 0.3 ? 14 : 30,
      severity: tankerRatio < 0.5 ? 'SEVERE' : 'HIGH',
      notes: 'Middle East exports >1M bbl/day jet fuel (17% global). Prices +33%.',
    },
    {
      chain: 'India/Pakistan Energy',
      days: transitRatio < 0.3 ? 7 : 14,
      severity: 'CRITICAL',
      notes: 'India: 50% crude + 60% gas via Hormuz. Pakistan: 99% LNG from Qatar+UAE.',
    },
  ];
}

// ---- 6. Full Report ----

export function generateSupplyChainReport(crisis) {
  const oil = computeOilDisruption(crisis);
  const lng = computeLngDisruption(crisis);
  const petrochem = computePetrochemDisruption(crisis);
  const semi = computeSemiDisruption(crisis);
  const daysToImpact = computeDaysToImpact(crisis);

  const commodities = [oil, lng, petrochem, semi];

  // Overall severity: worst of all commodity disruptions
  const maxDisruption = Math.max(...commodities.map(c => c.disruption_pct));
  let overall_severity;
  if (maxDisruption >= 90) overall_severity = 'CRITICAL';
  else if (maxDisruption >= 70) overall_severity = 'SEVERE';
  else if (maxDisruption >= 50) overall_severity = 'HIGH';
  else if (maxDisruption >= 30) overall_severity = 'ELEVATED';
  else overall_severity = 'NORMAL';

  const urgentChains = daysToImpact.filter(d => d.days <= 14);

  const summary = `Supply chain disruption is ${overall_severity}. ` +
    `Oil: ${oil.disruption_pct}% disrupted (${oil.current_estimate} vs ${oil.baseline_flow} baseline, bypass ${oil.bypass_capacity}). ` +
    `LNG: ${lng.disruption_pct}% disrupted — Qatar production halted. ` +
    `Petrochemicals: ${petrochem.disruption_pct}% disrupted (fertilizer crisis during spring planting). ` +
    `Semiconductors: ${semi.disruption_pct}% indirect risk. ` +
    `${urgentChains.length} supply chains reach critical impact within 14 days.`;

  return {
    timestamp: new Date().toISOString(),
    commodities,
    days_to_impact: daysToImpact,
    overall_severity,
    summary,
  };
}

// ---- CLI: read crisis-score.json, generate report ----

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main() {
  const projectRoot = resolve(__dirname, '..');
  const crisisPath = resolve(projectRoot, 'data', 'crisis-score.json');

  let crisis;
  try {
    crisis = JSON.parse(readFileSync(crisisPath, 'utf8'));
    console.log(`Loaded crisis score: ${crisis.overall.score}/100 (${crisis.overall.label})`);
  } catch {
    console.error('Could not read data/crisis-score.json — run scoring/score.js first');
    process.exit(1);
  }

  const report = generateSupplyChainReport(crisis);

  const outDir = resolve(projectRoot, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'supply-chain-impact.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nSupply Chain Impact Report written to ${outPath}`);
  console.log(`\n  Overall Severity: ${report.overall_severity}`);
  for (const c of report.commodities) {
    console.log(`  ${c.name}: ${c.disruption_pct}% disrupted (${c.current_estimate})`);
  }
  console.log(`\n  Days-to-Impact:`);
  for (const d of report.days_to_impact) {
    console.log(`    ${d.chain}: ${d.days} days (${d.severity})`);
  }
  console.log(`\n  Summary: ${report.summary}`);
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
