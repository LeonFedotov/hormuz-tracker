import { describe, it, expect } from 'vitest';
import {
  parseShipData,
  transitScore,
  flowBalance,
  strandedScore,
  tankerScore,
  crisisScore,
  generateReport,
} from '../scoring/score.js';

// ---- Helpers: create ship objects ----

/**
 * Make a ship entry object matching the ship-positions.json format.
 * Speed is in knots (not 1/10 knots like the old format).
 */
function makeShip(overrides = {}) {
  return {
    mmsi: '123456',
    lat: 26.5,
    lon: 56.3,
    speed_kn: 5.0,
    course: 280,
    heading: 280,
    name: 'TEST SHIP',
    ship_type: 'cargo',
    ship_type_code: 7,
    destination: 'FUJAIRAH',
    flag: 'PA',
    elapsed_sec: 5,
    timestamp: new Date().toISOString(),
    source: 'marinetraffic_har',
    type_name: null,
    status_name: null,
    length: 200,
    width: 30,
    dwt: 50000,
    ...overrides,
  };
}

// ---- parseShipData ----

describe('parseShipData', () => {
  it('converts raw objects to normalized ship objects', () => {
    const raw = [makeShip()];
    const ships = parseShipData(raw);
    expect(ships).toHaveLength(1);
    expect(ships[0]).toMatchObject({
      lat: 26.5,
      lon: 56.3,
      spd: 5.0,
      cog: 280,
      dest: 'FUJAIRAH',
      flag: 'PA',
      name: 'TEST SHIP',
      shiptype: 7,
      dwt: 50000,
    });
  });

  it('handles null and missing speed as 0', () => {
    const raw = [makeShip({ speed_kn: null }), makeShip({ speed_kn: undefined })];
    const ships = parseShipData(raw);
    expect(ships[0].spd).toBe(0);
    expect(ships[1].spd).toBe(0);
  });

  it('handles null lat/lon gracefully', () => {
    const raw = [makeShip({ lat: null, lon: null })];
    const ships = parseShipData(raw);
    expect(ships[0].lat).toBe(0);
    expect(ships[0].lon).toBe(0);
  });
});

// ---- transitScore ----

describe('transitScore', () => {
  it('returns 100 when traffic matches baseline', () => {
    const ships = Array.from({ length: 153 }, (_, i) =>
      makeShip({ lat: 26.0, lon: 56.5, speed_kn: 3.0, mmsi: String(i) })
    );
    const result = transitScore(parseShipData(ships));
    expect(result.score).toBe(100);
  });

  it('returns 0 when no ships in zone', () => {
    const result = transitScore([]);
    expect(result.score).toBe(0);
  });

  it('caps at 100 when traffic exceeds baseline', () => {
    const ships = Array.from({ length: 200 }, (_, i) =>
      makeShip({ lat: 26.0, lon: 56.5, speed_kn: 3.0, mmsi: String(i) })
    );
    const result = transitScore(parseShipData(ships));
    expect(result.score).toBe(100);
  });

  it('excludes ships outside the strait zone', () => {
    const inside = makeShip({ lat: 26.0, lon: 56.5, speed_kn: 3.0, mmsi: '1' });
    const outside = makeShip({ lat: 24.0, lon: 54.0, speed_kn: 3.0, mmsi: '2' });
    const result = transitScore(parseShipData([inside, outside]));
    expect(result.inZone).toBe(1);
  });

  it('excludes stationary ships from moving count', () => {
    const moving = makeShip({ lat: 26.0, lon: 56.5, speed_kn: 3.0, mmsi: '1' });
    const stopped = makeShip({ lat: 26.0, lon: 56.5, speed_kn: 0, mmsi: '2' });
    const result = transitScore(parseShipData([moving, stopped]));
    expect(result.inZone).toBe(2);
    expect(result.moving).toBe(1);
  });

  it('returns correct structure', () => {
    const result = transitScore([]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('inZone');
    expect(result).toHaveProperty('moving');
    expect(result).toHaveProperty('baseline');
  });
});

// ---- flowBalance ----

describe('flowBalance', () => {
  it('returns balanced score for equal inbound/outbound', () => {
    const inbound = Array.from({ length: 20 }, (_, i) =>
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 310, mmsi: `in${i}` })
    );
    const outbound = Array.from({ length: 20 }, (_, i) =>
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 130, mmsi: `out${i}` })
    );
    const result = flowBalance(parseShipData([...inbound, ...outbound]));
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.inbound).toBe(20);
    expect(result.outbound).toBe(20);
  });

  it('returns low score for heavy imbalance', () => {
    const inbound = Array.from({ length: 30 }, (_, i) =>
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 310, mmsi: `in${i}` })
    );
    const outbound = [
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 130, mmsi: 'out0' }),
    ];
    const result = flowBalance(parseShipData([...inbound, ...outbound]));
    expect(result.score).toBeLessThan(40);
  });

  it('returns 0 score when no moving ships in zone', () => {
    const result = flowBalance([]);
    expect(result.score).toBe(0);
    expect(result.inbound).toBe(0);
    expect(result.outbound).toBe(0);
  });

  it('returns ratio string', () => {
    const ships = [
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 310, mmsi: 'in0' }),
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, course: 130, mmsi: 'out0' }),
    ];
    const result = flowBalance(parseShipData(ships));
    expect(result).toHaveProperty('ratio');
    expect(typeof result.ratio).toBe('string');
  });
});

// ---- strandedScore ----

describe('strandedScore', () => {
  it('returns high score when few ships are stranded', () => {
    const moving = Array.from({ length: 50 }, (_, i) =>
      makeShip({ speed_kn: 5.0, destination: 'FUJAIRAH', mmsi: `m${i}` })
    );
    const result = strandedScore(parseShipData(moving));
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.count).toBe(0);
  });

  it('returns low score when many ships stranded', () => {
    const stranded = Array.from({ length: 80 }, (_, i) =>
      makeShip({ speed_kn: 0, destination: 'FUJAIRAH', dwt: 50000, mmsi: `s${i}` })
    );
    const result = strandedScore(parseShipData(stranded));
    expect(result.score).toBeLessThan(30);
    expect(result.count).toBe(80);
  });

  it('does not count ships without destination as stranded', () => {
    const noDest = makeShip({ speed_kn: 0, destination: '', mmsi: '1' });
    const result = strandedScore(parseShipData([noDest]));
    expect(result.count).toBe(0);
  });

  it('accumulates DWT of stranded vessels', () => {
    const s1 = makeShip({ speed_kn: 0, destination: 'SOHAR', dwt: 100000, mmsi: '1' });
    const s2 = makeShip({ speed_kn: 0, destination: 'FUJAIRAH', dwt: 200000, mmsi: '2' });
    const result = strandedScore(parseShipData([s1, s2]));
    expect(result.count).toBe(2);
    expect(result.dwt).toBe(300000);
  });

  it('does not count CLASS B transponder or ORDERS as stranded', () => {
    const classB = makeShip({ speed_kn: 0, destination: 'CLASS B', mmsi: '1' });
    const orders = makeShip({ speed_kn: 0, destination: 'ORDERS', mmsi: '2' });
    const forOrders = makeShip({ speed_kn: 0, destination: 'FOR ORDERS', mmsi: '3' });
    const result = strandedScore(parseShipData([classB, orders, forOrders]));
    expect(result.count).toBe(0);
  });

  it('returns correct structure', () => {
    const result = strandedScore([]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('dwt');
  });
});

// ---- tankerScore ----

describe('tankerScore', () => {
  it('returns high score when tanker traffic at baseline', () => {
    const tankers = Array.from({ length: 35 }, (_, i) =>
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'tanker', ship_type_code: 8, mmsi: `t${i}` })
    );
    const result = tankerScore(parseShipData(tankers));
    expect(result.score).toBe(100);
  });

  it('returns low score when few tankers transiting', () => {
    const tankers = Array.from({ length: 5 }, (_, i) =>
      makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'tanker', ship_type_code: 8, mmsi: `t${i}` })
    );
    const result = tankerScore(parseShipData(tankers));
    expect(result.score).toBeLessThan(30);
  });

  it('ignores non-tanker ships', () => {
    const cargo = makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'cargo', ship_type_code: 7, mmsi: '1' });
    const tanker = makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'tanker', ship_type_code: 8, mmsi: '2' });
    const result = tankerScore(parseShipData([cargo, tanker]));
    expect(result.count).toBe(1);
  });

  it('distinguishes moving vs stationary tankers', () => {
    const moving = makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'tanker', ship_type_code: 8, mmsi: '1' });
    const stopped = makeShip({ lat: 26.3, lon: 56.5, speed_kn: 0, ship_type: 'tanker', ship_type_code: 8, mmsi: '2' });
    const result = tankerScore(parseShipData([moving, stopped]));
    expect(result.count).toBe(2);
    expect(result.moving).toBe(1);
  });

  it('returns correct structure', () => {
    const result = tankerScore([]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('moving');
    expect(result).toHaveProperty('baseline');
  });
});

// ---- crisisScore ----

describe('crisisScore', () => {
  it('returns NORMAL for all-high component scores', () => {
    const result = crisisScore(
      { score: 95 }, { score: 90 }, { score: 95 }, { score: 90 }, 0
    );
    expect(result.overall).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe('NORMAL');
  });

  it('returns CRITICAL for all-zero component scores with incidents', () => {
    const result = crisisScore(
      { score: 0 }, { score: 0 }, { score: 0 }, { score: 0 }, 10
    );
    expect(result.overall).toBeLessThanOrEqual(10);
    expect(result.label).toBe('CRITICAL');
  });

  it('returns ELEVATED for moderately degraded scores', () => {
    const result = crisisScore(
      { score: 60 }, { score: 55 }, { score: 65 }, { score: 50 }, 1
    );
    expect(result.overall).toBeGreaterThanOrEqual(40);
    expect(result.overall).toBeLessThan(80);
    expect(['ELEVATED', 'HIGH']).toContain(result.label);
  });

  it('returns weighted composite as overall score', () => {
    const result = crisisScore(
      { score: 50 }, { score: 50 }, { score: 50 }, { score: 50 }, 0
    );
    expect(result.overall).toBe(50);
  });

  it('incident count reduces score', () => {
    const noIncidents = crisisScore(
      { score: 80 }, { score: 80 }, { score: 80 }, { score: 80 }, 0
    );
    const withIncidents = crisisScore(
      { score: 80 }, { score: 80 }, { score: 80 }, { score: 80 }, 5
    );
    expect(withIncidents.overall).toBeLessThan(noIncidents.overall);
  });

  it('returns correct structure', () => {
    const result = crisisScore(
      { score: 50 }, { score: 50 }, { score: 50 }, { score: 50 }, 0
    );
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('components');
  });

  it('label thresholds: SEVERE below 40, HIGH below 60', () => {
    const severe = crisisScore(
      { score: 30 }, { score: 30 }, { score: 30 }, { score: 30 }, 1
    );
    expect(severe.label).toBe('SEVERE');

    const high = crisisScore(
      { score: 50 }, { score: 50 }, { score: 50 }, { score: 50 }, 1
    );
    expect(high.label).toBe('HIGH');
  });
});

// ---- generateReport ----

describe('generateReport', () => {
  it('returns a complete report object', () => {
    const ships = [
      ...Array.from({ length: 30 }, (_, i) =>
        makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0, ship_type: 'tanker', ship_type_code: 8, course: 310, mmsi: `t${i}` })
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        makeShip({ lat: 26.3, lon: 56.5, speed_kn: 6.0, ship_type: 'cargo', ship_type_code: 7, course: 130, mmsi: `c${i}` })
      ),
    ];
    const report = generateReport(parseShipData(ships), []);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('overall');
    expect(report.overall).toHaveProperty('score');
    expect(report.overall).toHaveProperty('label');
    expect(report.overall).toHaveProperty('description');
    expect(report).toHaveProperty('transit');
    expect(report).toHaveProperty('flow');
    expect(report).toHaveProperty('stranded');
    expect(report).toHaveProperty('tankers');
    expect(report).toHaveProperty('confidence');
    expect(report).toHaveProperty('summary');
  });

  it('includes incident count in report', () => {
    const ships = [makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0 })];
    const events = [{ type: 'incident' }, { type: 'vessel_attack' }, { type: 'news' }];
    const report = generateReport(parseShipData(ships), events);
    expect(report.overall).toHaveProperty('score');
  });

  it('summary is a non-empty string', () => {
    const ships = [makeShip({ lat: 26.3, lon: 56.5, speed_kn: 5.0 })];
    const report = generateReport(parseShipData(ships), []);
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(10);
  });
});
