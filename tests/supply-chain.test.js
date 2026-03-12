import { describe, it, expect } from 'vitest';
import {
  computeOilDisruption,
  computeLngDisruption,
  computePetrochemDisruption,
  computeSemiDisruption,
  computeDaysToImpact,
  generateSupplyChainReport,
} from '../scoring/supply-chain.js';

// --- Mock crisis score data ---

function makeCrisisScore(overrides = {}) {
  return {
    overall: { score: 42, label: 'HIGH' },
    transit: { score: 46, inZone: 258, moving: 71, baseline: 153 },
    flow: { score: 85, inbound: 33, outbound: 28, ratio: '33:28' },
    stranded: { score: 0, count: 597, totalDwt: 27094000 },
    tankers: { score: 86, count: 132, moving: 30, baseline: 35 },
    ...overrides,
  };
}

// --- Oil disruption ---

describe('computeOilDisruption', () => {
  it('returns baseline of 20M bbl/day', () => {
    const result = computeOilDisruption(makeCrisisScore());
    expect(result.baseline_flow).toBe('20M bbl/day');
  });

  it('estimates current flow from tanker transit ratio + bypass', () => {
    const result = computeOilDisruption(makeCrisisScore());
    expect(result.current_estimate).toBeDefined();
    expect(result.disruption_pct).toBeGreaterThanOrEqual(0);
    expect(result.disruption_pct).toBeLessThanOrEqual(100);
  });

  it('returns ~100% disruption when no tankers transiting', () => {
    const crisis = makeCrisisScore({
      tankers: { score: 0, count: 0, moving: 0, baseline: 35 },
    });
    const result = computeOilDisruption(crisis);
    // Even with bypass (2.6M), disruption should be very high
    expect(result.disruption_pct).toBeGreaterThan(80);
  });

  it('returns low disruption when tankers at baseline', () => {
    const crisis = makeCrisisScore({
      tankers: { score: 100, count: 40, moving: 35, baseline: 35 },
    });
    const result = computeOilDisruption(crisis);
    expect(result.disruption_pct).toBeLessThan(20);
  });

  it('includes bypass capacity in calculation', () => {
    const result = computeOilDisruption(makeCrisisScore());
    expect(result.bypass_capacity).toBe('2.6M bbl/day');
  });

  it('lists downstream impacts', () => {
    const result = computeOilDisruption(makeCrisisScore());
    expect(Array.isArray(result.downstream_impacts)).toBe(true);
    expect(result.downstream_impacts.length).toBeGreaterThan(0);
  });
});

// --- LNG disruption ---

describe('computeLngDisruption', () => {
  it('returns baseline of 110 bcm/year', () => {
    const result = computeLngDisruption(makeCrisisScore());
    expect(result.baseline_flow).toBe('110 bcm/year');
  });

  it('shows near-total disruption when transit is low', () => {
    const crisis = makeCrisisScore({
      transit: { score: 5, inZone: 10, moving: 2, baseline: 153 },
    });
    const result = computeLngDisruption(crisis);
    expect(result.disruption_pct).toBeGreaterThan(90);
  });

  it('notes Qatar production halt', () => {
    const result = computeLngDisruption(makeCrisisScore());
    expect(result.notes).toMatch(/Qatar|halted|Ras Laffan/i);
  });

  it('lists downstream impacts including Taiwan, Europe, India', () => {
    const result = computeLngDisruption(makeCrisisScore());
    const impacts = result.downstream_impacts.map(d => d.toLowerCase()).join(' ');
    expect(impacts).toMatch(/taiwan|europe|india/i);
  });
});

// --- Petrochemicals disruption ---

describe('computePetrochemDisruption', () => {
  it('tracks sulfur, urea, ammonia', () => {
    const result = computePetrochemDisruption(makeCrisisScore());
    expect(result.name).toMatch(/petrochem/i);
    expect(result.sub_commodities).toBeDefined();
    const names = result.sub_commodities.map(s => s.name.toLowerCase());
    expect(names).toContain('sulfur');
    expect(names).toContain('urea');
    expect(names).toContain('ammonia');
  });

  it('disruption correlates with transit score', () => {
    const low = computePetrochemDisruption(makeCrisisScore({
      transit: { score: 10, inZone: 20, moving: 5, baseline: 153 },
    }));
    const high = computePetrochemDisruption(makeCrisisScore({
      transit: { score: 90, inZone: 150, moving: 130, baseline: 153 },
    }));
    expect(low.disruption_pct).toBeGreaterThan(high.disruption_pct);
  });
});

// --- Semiconductor disruption ---

describe('computeSemiDisruption', () => {
  it('references TSMC and chemical stockpiles', () => {
    const result = computeSemiDisruption(makeCrisisScore());
    expect(result.name).toMatch(/semiconductor/i);
    const text = JSON.stringify(result).toLowerCase();
    expect(text).toMatch(/tsmc|sulfuric acid|stockpile/);
  });

  it('days_to_critical is 30-60 for chemical stockpile pathway', () => {
    const result = computeSemiDisruption(makeCrisisScore());
    expect(result.days_to_critical).toBeGreaterThanOrEqual(14);
    expect(result.days_to_critical).toBeLessThanOrEqual(90);
  });
});

// --- Days-to-impact calculator ---

describe('computeDaysToImpact', () => {
  it('returns entries for key chains', () => {
    const result = computeDaysToImpact(makeCrisisScore());
    expect(Array.isArray(result)).toBe(true);
    const chains = result.map(r => r.chain.toLowerCase());
    expect(chains.some(c => c.includes('tsmc') || c.includes('semiconductor'))).toBe(true);
    expect(chains.some(c => c.includes('europe') || c.includes('gas'))).toBe(true);
    expect(chains.some(c => c.includes('fertilizer'))).toBe(true);
    expect(chains.some(c => c.includes('food') || c.includes('gulf'))).toBe(true);
  });

  it('each entry has chain, days, severity, notes', () => {
    const result = computeDaysToImpact(makeCrisisScore());
    for (const entry of result) {
      expect(entry).toHaveProperty('chain');
      expect(entry).toHaveProperty('days');
      expect(entry).toHaveProperty('severity');
      expect(typeof entry.days).toBe('number');
    }
  });

  it('Gulf food supply days is around 10', () => {
    const result = computeDaysToImpact(makeCrisisScore());
    const food = result.find(r => r.chain.toLowerCase().includes('food'));
    expect(food.days).toBeLessThanOrEqual(14);
  });
});

// --- Full report ---

describe('generateSupplyChainReport', () => {
  it('returns commodities array, overall_severity, and summary', () => {
    const report = generateSupplyChainReport(makeCrisisScore());
    expect(report).toHaveProperty('commodities');
    expect(report).toHaveProperty('days_to_impact');
    expect(report).toHaveProperty('overall_severity');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('timestamp');
    expect(Array.isArray(report.commodities)).toBe(true);
    expect(report.commodities.length).toBe(4); // oil, lng, petrochem, semi
  });

  it('overall_severity is a string label', () => {
    const report = generateSupplyChainReport(makeCrisisScore());
    expect(['CRITICAL', 'SEVERE', 'HIGH', 'ELEVATED', 'NORMAL']).toContain(report.overall_severity);
  });

  it('summary is a non-empty string', () => {
    const report = generateSupplyChainReport(makeCrisisScore());
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(20);
  });

  it('commodities have required fields', () => {
    const report = generateSupplyChainReport(makeCrisisScore());
    for (const c of report.commodities) {
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('baseline_flow');
      expect(c).toHaveProperty('disruption_pct');
      expect(c).toHaveProperty('downstream_impacts');
    }
  });
});
