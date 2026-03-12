import { describe, it, expect } from 'vitest';

// The script is .cjs but we export pure functions for testing
const {
  PHASES,
  isInGulf,
  deduplicateByMmsi,
  normalizeShipType,
  buildCollectionSummary,
} = require('../scripts/collect-ais-extended.cjs');

// ── PHASES config ───────────────────────────────────────────────

describe('PHASES', () => {
  it('has at least 3 phases for rotation strategy', () => {
    expect(PHASES.length).toBeGreaterThanOrEqual(3);
  });

  it('each phase has name, bbox, and duration', () => {
    for (const phase of PHASES) {
      expect(phase).toHaveProperty('name');
      expect(phase).toHaveProperty('bbox');
      expect(phase).toHaveProperty('durationMs');
      expect(phase.durationMs).toBeGreaterThan(0);
      expect(phase.bbox).toBeInstanceOf(Array);
    }
  });

  it('first phase targets Gulf specifically', () => {
    expect(PHASES[0].name).toMatch(/gulf/i);
  });

  it('later phases widen the search area', () => {
    // The wider phase bbox should cover more area than Gulf phase
    const gulfBbox = PHASES[0].bbox[0];
    const widerPhase = PHASES.find(p => /wide|ocean|global/i.test(p.name));
    expect(widerPhase).toBeDefined();
    const widerBbox = widerPhase.bbox[0];
    const gulfArea = (gulfBbox[1][0] - gulfBbox[0][0]) * (gulfBbox[1][1] - gulfBbox[0][1]);
    const widerArea = (widerBbox[1][0] - widerBbox[0][0]) * (widerBbox[1][1] - widerBbox[0][1]);
    expect(widerArea).toBeGreaterThan(gulfArea);
  });
});

// ── isInGulf ────────────────────────────────────────────────────

describe('isInGulf', () => {
  it('returns true for Strait of Hormuz', () => {
    expect(isInGulf(26.5, 56.5)).toBe(true);
  });

  it('returns true for central Persian Gulf', () => {
    expect(isInGulf(27.0, 51.0)).toBe(true);
  });

  it('returns true for Gulf of Oman', () => {
    expect(isInGulf(24.0, 59.0)).toBe(true);
  });

  it('returns false for Indian Ocean far south', () => {
    expect(isInGulf(5.0, 70.0)).toBe(false);
  });

  it('returns false for Mediterranean', () => {
    expect(isInGulf(35.0, 30.0)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isInGulf(null, 50)).toBe(false);
    expect(isInGulf(26, null)).toBe(false);
  });
});

// ── deduplicateByMmsi ──────────────────────────────────────────

describe('deduplicateByMmsi', () => {
  it('merges ships from two maps keeping latest timestamp', () => {
    const existing = new Map([
      ['123', { mmsi: '123', name: 'OLD', timestamp: '2026-01-01T00:00:00Z', lat: 25 }],
    ]);
    const incoming = [
      { mmsi: '123', name: 'NEW', timestamp: '2026-01-01T01:00:00Z', lat: 26 },
      { mmsi: '456', name: 'SHIP2', timestamp: '2026-01-01T00:30:00Z', lat: 27 },
    ];
    const result = deduplicateByMmsi(existing, incoming);
    expect(result.size).toBe(2);
    expect(result.get('123').name).toBe('NEW');
    expect(result.get('123').lat).toBe(26);
    expect(result.get('456').name).toBe('SHIP2');
  });

  it('keeps existing when incoming has older timestamp', () => {
    const existing = new Map([
      ['123', { mmsi: '123', name: 'NEWER', timestamp: '2026-01-01T02:00:00Z' }],
    ]);
    const incoming = [
      { mmsi: '123', name: 'OLDER', timestamp: '2026-01-01T00:00:00Z' },
    ];
    const result = deduplicateByMmsi(existing, incoming);
    expect(result.get('123').name).toBe('NEWER');
  });

  it('handles empty existing map', () => {
    const result = deduplicateByMmsi(new Map(), [
      { mmsi: '789', name: 'SOLO' },
    ]);
    expect(result.size).toBe(1);
  });

  it('handles empty incoming array', () => {
    const existing = new Map([['123', { mmsi: '123' }]]);
    const result = deduplicateByMmsi(existing, []);
    expect(result.size).toBe(1);
  });

  it('merges static data fields from existing when incoming lacks them', () => {
    const existing = new Map([
      ['123', { mmsi: '123', name: 'TANKER', imo: 9876543, length: 300 }],
    ]);
    const incoming = [
      { mmsi: '123', timestamp: '2026-01-02T00:00:00Z', lat: 26, lon: 55 },
    ];
    const result = deduplicateByMmsi(existing, incoming);
    // Should keep imo and length from existing, update position from incoming
    expect(result.get('123').imo).toBe(9876543);
    expect(result.get('123').lat).toBe(26);
  });
});

// ── normalizeShipType ──────────────────────────────────────────

describe('normalizeShipType', () => {
  it('maps tanker codes (80-89) to tanker', () => {
    expect(normalizeShipType(80)).toBe('tanker');
    expect(normalizeShipType(84)).toBe('tanker');
    expect(normalizeShipType(89)).toBe('tanker');
  });

  it('maps cargo codes (70-79) to cargo', () => {
    expect(normalizeShipType(70)).toBe('cargo');
    expect(normalizeShipType(74)).toBe('cargo');
    expect(normalizeShipType(79)).toBe('cargo');
  });

  it('maps fishing to fishing', () => {
    expect(normalizeShipType(30)).toBe('fishing');
  });

  it('maps tug codes to tug', () => {
    expect(normalizeShipType(31)).toBe('tug');
    expect(normalizeShipType(32)).toBe('tug');
    expect(normalizeShipType(52)).toBe('tug');
  });

  it('maps 0 to unknown', () => {
    expect(normalizeShipType(0)).toBe('unknown');
  });

  it('maps unrecognized codes to other', () => {
    expect(normalizeShipType(99)).toBe('other');
    expect(normalizeShipType(15)).toBe('other');
  });
});

// ── buildCollectionSummary ─────────────────────────────────────

describe('buildCollectionSummary', () => {
  it('includes collection metadata', () => {
    const ships = new Map([
      ['111', { mmsi: '111', ship_type: 80, ship_type_name: 'tanker', speed_kn: 12, lat: 26, lon: 56, flag: 'PA' }],
      ['222', { mmsi: '222', ship_type: 70, ship_type_name: 'cargo', speed_kn: 0, lat: 27, lon: 51, flag: 'LR' }],
    ]);
    const phases = [
      { name: 'Gulf', shipsFound: 1, msgsReceived: 5 },
      { name: 'Wide', shipsFound: 2, msgsReceived: 150 },
    ];
    const summary = buildCollectionSummary(ships, phases);
    expect(summary).toHaveProperty('_meta');
    expect(summary._meta).toHaveProperty('collected_at');
    expect(summary._meta).toHaveProperty('total_ships');
    expect(summary._meta.total_ships).toBe(2);
    expect(summary._meta).toHaveProperty('phases');
    expect(summary._meta.phases).toHaveLength(2);
  });

  it('includes ships as array', () => {
    const ships = new Map([
      ['111', { mmsi: '111', ship_type: 80, speed_kn: 12, lat: 26, lon: 56, flag: 'PA' }],
    ]);
    const summary = buildCollectionSummary(ships, []);
    expect(summary.ships).toBeInstanceOf(Array);
    expect(summary.ships).toHaveLength(1);
  });

  it('includes gulf_analysis with shipping collapse evidence', () => {
    const ships = new Map([
      ['111', { mmsi: '111', ship_type: 80, speed_kn: 12, lat: 26, lon: 56, flag: 'PA' }],
    ]);
    const phases = [{ name: 'Gulf', shipsFound: 1, msgsReceived: 3 }];
    const summary = buildCollectionSummary(ships, phases);
    expect(summary).toHaveProperty('gulf_analysis');
    expect(summary.gulf_analysis).toHaveProperty('gulf_ship_count');
    expect(summary.gulf_analysis).toHaveProperty('assessment');
  });

  it('flags near-empty Gulf as shipping collapse evidence', () => {
    // Only 1 ship found in Gulf in extended collection = collapse
    const ships = new Map([
      ['111', { mmsi: '111', lat: 26, lon: 56 }],
    ]);
    const phases = [{ name: 'Gulf', shipsFound: 1, msgsReceived: 2 }];
    const summary = buildCollectionSummary(ships, phases);
    expect(summary.gulf_analysis.assessment).toMatch(/collapse|near.?empty|minimal|critical/i);
  });

  it('handles zero ships', () => {
    const summary = buildCollectionSummary(new Map(), []);
    expect(summary._meta.total_ships).toBe(0);
    expect(summary.ships).toEqual([]);
  });
});
