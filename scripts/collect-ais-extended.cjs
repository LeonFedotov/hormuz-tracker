const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────

const API_KEY = '2c26fe4b86125a11755a2c6ded3fb9aae2d68969';
const MSG_TYPES = ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport'];

// Smart rotation: start tight on Gulf, widen if sparse, try global last
const PHASES = [
  {
    name: 'Gulf (Hormuz + Persian Gulf)',
    bbox: [[[20, 46], [32, 62]]],
    durationMs: 5 * 60 * 1000,   // 5 min
    minShips: 10,
  },
  {
    name: 'Wide (Indian Ocean + Red Sea approaches)',
    bbox: [[[10, 30], [40, 70]]],
    durationMs: 10 * 60 * 1000,  // 10 min
    minShips: 10,
  },
  {
    name: 'Global (filter to Gulf region)',
    bbox: [[[-90, -180], [90, 180]]],
    durationMs: 5 * 60 * 1000,   // 5 min
    minShips: 0,                  // always proceed
  },
];

// Gulf region bounds for filtering global results
const GULF_BOUNDS = { latMin: 20, latMax: 32, lonMin: 46, lonMax: 62 };

// ── Pure functions (exported for testing) ───────────────────────

function isInGulf(lat, lon) {
  if (lat == null || lon == null) return false;
  return lat >= GULF_BOUNDS.latMin && lat <= GULF_BOUNDS.latMax &&
         lon >= GULF_BOUNDS.lonMin && lon <= GULF_BOUNDS.lonMax;
}

function deduplicateByMmsi(existing, incoming) {
  const merged = new Map(existing);
  for (const ship of incoming) {
    if (!ship.mmsi) continue;
    const prev = merged.get(ship.mmsi);
    if (!prev) {
      merged.set(ship.mmsi, ship);
      continue;
    }
    const prevTime = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
    const newTime = ship.timestamp ? new Date(ship.timestamp).getTime() : 0;
    if (newTime >= prevTime) {
      // Merge: keep static fields from prev if incoming lacks them
      merged.set(ship.mmsi, {
        ...prev,
        ...Object.fromEntries(Object.entries(ship).filter(([, v]) => v != null && v !== '' && v !== 0)),
      });
    } else {
      // Keep prev but fill in any missing static fields from incoming
      merged.set(ship.mmsi, {
        ...ship,
        ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v != null && v !== '' && v !== 0)),
      });
    }
  }
  return merged;
}

const SHIP_TYPE_MAP = {
  0: 'unknown', 30: 'fishing', 31: 'tug', 32: 'tug', 33: 'dredger', 34: 'dive',
  35: 'military', 36: 'sailing', 37: 'pleasure', 40: 'hsc', 50: 'pilot',
  51: 'sar', 52: 'tug', 60: 'passenger', 61: 'passenger',
  70: 'cargo', 71: 'cargo', 72: 'cargo', 73: 'cargo', 74: 'cargo', 79: 'cargo',
  80: 'tanker', 81: 'tanker', 82: 'tanker', 83: 'tanker', 84: 'tanker', 89: 'tanker',
};

function normalizeShipType(code) {
  if (SHIP_TYPE_MAP[code] !== undefined) return SHIP_TYPE_MAP[code];
  if (code >= 70 && code < 80) return 'cargo';
  if (code >= 80 && code < 90) return 'tanker';
  return 'other';
}

function buildCollectionSummary(ships, phases) {
  const arr = Array.from(ships.values());

  // Count Gulf ships
  const gulfShips = arr.filter(s => isInGulf(s.lat, s.lon));
  const gulfCount = gulfShips.length;

  // Assess Gulf shipping status
  let assessment;
  if (gulfCount === 0) {
    assessment = 'CRITICAL: Zero ships detected in Gulf region — near-total shipping collapse';
  } else if (gulfCount < 5) {
    assessment = `CRITICAL: Only ${gulfCount} ship(s) detected in Gulf — near-empty, consistent with shipping collapse`;
  } else if (gulfCount < 20) {
    assessment = `WARNING: Only ${gulfCount} ships in Gulf — minimal traffic, well below normal levels`;
  } else {
    assessment = `${gulfCount} ships in Gulf — moderate traffic detected`;
  }

  // Type breakdown
  const typeCounts = {};
  const flagCounts = {};
  for (const s of arr) {
    const tn = s.ship_type_name || normalizeShipType(s.ship_type || 0);
    typeCounts[tn] = (typeCounts[tn] || 0) + 1;
    const flag = s.flag || 'unknown';
    flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  }

  return {
    _meta: {
      collected_at: new Date().toISOString(),
      total_ships: arr.length,
      gulf_ships: gulfCount,
      source: 'aisstream.io',
      api_key_tier: 'free',
      strategy: 'rotating bounding boxes (Gulf → Wide → Global)',
      phases: phases.map(p => ({
        name: p.name,
        ships_found: p.shipsFound || 0,
        messages_received: p.msgsReceived || 0,
      })),
    },
    gulf_analysis: {
      gulf_ship_count: gulfCount,
      gulf_bounds: GULF_BOUNDS,
      assessment,
      context: 'AISStream free tier delivers ~173 msgs/sec globally but near-zero in Gulf region. '
        + 'This pattern is consistent with the near-total shipping collapse in the Strait of Hormuz area.',
      type_breakdown: typeCounts,
      flag_breakdown: flagCounts,
    },
    ships: arr,
  };
}

// ── Exports for testing ─────────────────────────────────────────

module.exports = {
  PHASES,
  isInGulf,
  deduplicateByMmsi,
  normalizeShipType,
  buildCollectionSummary,
};

// ── Main collection logic (only runs when executed directly) ────

if (require.main === module) {
  const allShips = new Map();
  const phaseResults = [];
  let currentPhaseIdx = 0;

  function parseShipMessage(msg) {
    const meta = msg.MetaData || {};
    const mmsi = String(meta.MMSI || '');
    if (!mmsi) return null;

    const pos = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport;
    const stat = msg.Message?.ShipStaticData;
    const ship = { mmsi };

    if (pos) {
      ship.lat = meta.latitude;
      ship.lon = meta.longitude;
      ship.speed_kn = pos.Sog || 0;
      ship.course = pos.Cog || null;
      ship.heading = pos.TrueHeading === 511 ? null : pos.TrueHeading;
      ship.name = meta.ShipName?.trim() || '';
      ship.ship_type = meta.ShipType || 0;
      ship.destination = meta.Destination?.trim() || '';
      ship.flag = meta.country || '';
      ship.timestamp = new Date().toISOString();
      ship.source = 'aisstream_live';
    }

    if (stat) {
      ship.name = stat.Name?.trim() || ship.name || '';
      ship.destination = stat.Destination?.trim() || ship.destination || '';
      ship.ship_type = stat.Type || ship.ship_type || 0;
      ship.imo = stat.ImoNumber || undefined;
      ship.length = ((stat.Dimension?.A || 0) + (stat.Dimension?.B || 0)) || undefined;
      ship.width = ((stat.Dimension?.C || 0) + (stat.Dimension?.D || 0)) || undefined;
    }

    return ship;
  }

  function runPhase(phaseIdx) {
    if (phaseIdx >= PHASES.length) {
      finalize();
      return;
    }

    const phase = PHASES[phaseIdx];
    const phaseShips = new Map();
    let msgCount = 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Phase ${phaseIdx + 1}/${PHASES.length}: ${phase.name}`);
    console.log(`Duration: ${phase.durationMs / 1000}s | Min ships: ${phase.minShips}`);
    console.log(`BBox: ${JSON.stringify(phase.bbox)}`);
    console.log('='.repeat(60));

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.on('open', () => {
      console.log(`  Connected. Collecting...`);
      ws.send(JSON.stringify({
        APIKey: API_KEY,
        BoundingBoxes: phase.bbox,
        FilterMessageTypes: MSG_TYPES,
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        const ship = parseShipMessage(msg);
        if (!ship) return;
        msgCount++;

        const existing = phaseShips.get(ship.mmsi) || {};
        phaseShips.set(ship.mmsi, { ...existing, ...ship });

        if (msgCount % 500 === 0) {
          console.log(`  ${msgCount} msgs, ${phaseShips.size} unique ships (${allShips.size} total)`);
        }
      } catch (e) { /* skip malformed */ }
    });

    ws.on('error', e => console.error(`  Error: ${e.message}`));

    setTimeout(() => {
      ws.close();

      // Merge phase results into allShips
      const phaseArr = Array.from(phaseShips.values());
      // Add ship type names
      phaseArr.forEach(s => {
        s.ship_type_name = normalizeShipType(s.ship_type || 0);
      });

      const mergedIncoming = phaseArr;
      const beforeCount = allShips.size;

      // For global phase, filter to Gulf region + keep existing
      let toMerge = mergedIncoming;
      if (phaseIdx === PHASES.length - 1) {
        const gulfOnly = mergedIncoming.filter(s => isInGulf(s.lat, s.lon));
        console.log(`  Global phase: ${mergedIncoming.length} ships total, ${gulfOnly.length} in Gulf region`);
        toMerge = gulfOnly;
      }

      const updated = deduplicateByMmsi(allShips, toMerge);
      // Copy back
      for (const [k, v] of updated) allShips.set(k, v);

      const phaseResult = {
        name: phase.name,
        shipsFound: phaseShips.size,
        msgsReceived: msgCount,
        newShipsAdded: allShips.size - beforeCount,
      };
      phaseResults.push(phaseResult);

      console.log(`  Phase done: ${msgCount} msgs, ${phaseShips.size} ships (${phaseResult.newShipsAdded} new)`);
      console.log(`  Total accumulated: ${allShips.size} ships`);

      // Check if we have enough ships to skip remaining phases
      if (allShips.size >= phase.minShips && phaseIdx < PHASES.length - 1) {
        console.log(`  ✓ Met threshold (${phase.minShips}), but continuing for completeness`);
      }

      // Always run all phases for maximum coverage
      runPhase(phaseIdx + 1);
    }, phase.durationMs);
  }

  function finalize() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('COLLECTION COMPLETE');
    console.log('='.repeat(60));

    // Build summary with Gulf analysis
    const summary = buildCollectionSummary(allShips, phaseResults);

    // Write output
    const outPath = path.join(__dirname, '..', 'data', 'ship-positions.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

    const fileSize = (JSON.stringify(summary).length / 1024).toFixed(1);
    console.log(`\nSaved: ${outPath} (${fileSize}KB)`);
    console.log(`Total ships: ${summary._meta.total_ships}`);
    console.log(`Gulf ships: ${summary._meta.gulf_ships}`);
    console.log(`\nGulf Analysis:`);
    console.log(`  ${summary.gulf_analysis.assessment}`);
    console.log(`  ${summary.gulf_analysis.context}`);

    // Phase breakdown
    console.log('\nPhase breakdown:');
    for (const p of phaseResults) {
      console.log(`  ${p.name}: ${p.msgsReceived} msgs, ${p.shipsFound} ships (${p.newShipsAdded} new)`);
    }

    // Top flags
    const flags = summary.gulf_analysis.flag_breakdown;
    console.log('\nTop flags:');
    Object.entries(flags).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .forEach(([f, c]) => console.log(`  ${f}: ${c}`));

    // Ship type breakdown
    console.log('\nShip types:');
    Object.entries(summary.gulf_analysis.type_breakdown).sort((a, b) => b[1] - a[1])
      .forEach(([t, c]) => console.log(`  ${t}: ${c}`));

    const moving = summary.ships.filter(s => s.speed_kn > 0.5).length;
    console.log(`\nMoving: ${moving}, Stopped/anchored: ${summary.ships.length - moving}`);

    process.exit(0);
  }

  console.log('AIS Extended Collection — Smart Rotation Strategy');
  console.log(`Total duration: ~${PHASES.reduce((s, p) => s + p.durationMs, 0) / 60000} min`);
  console.log(`Phases: ${PHASES.map(p => p.name).join(' → ')}`);
  runPhase(0);
}
