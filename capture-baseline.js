// Connect to AISStream, collect positions for 3 minutes, save as baseline
const WebSocket = require('ws');
const fs = require('fs');

const API_KEY = '3c091de6aba479eb3d6e6354b46e579b470d6388';
// Focused: Persian Gulf + Strait + Gulf of Oman (free tier works better with reasonable bbox)
const BBOX = [[22.0, 48.0], [30.0, 60.0]];

const ships = new Map();
let msgCount = 0;

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

ws.on('open', () => {
  console.log('Connected to AISStream.');
  console.log('BBox:', JSON.stringify(BBOX));
  console.log('Collecting for 3 minutes...');
  ws.send(JSON.stringify({
    APIKey: API_KEY,
    BoundingBoxes: [BBOX],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport']
  }));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    const meta = msg.MetaData || {};
    const mmsi = String(meta.MMSI || '');
    if (!mmsi) return;
    msgCount++;

    const pos = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport;
    if (pos) {
      const existing = ships.get(mmsi) || {};
      ships.set(mmsi, {
        ...existing,
        mmsi,
        lat: meta.latitude,
        lon: meta.longitude,
        sog: pos.Sog || 0,
        cog: pos.Cog || pos.TrueHeading || 0,
        name: meta.ShipName || existing.name || '',
        shipType: meta.ShipType || existing.shipType || 0,
        destination: meta.Destination || existing.destination || '',
        ts: Date.now()
      });
    }

    const stat = msg.Message?.ShipStaticData;
    if (stat) {
      const existing = ships.get(mmsi) || {};
      ships.set(mmsi, {
        ...existing,
        mmsi,
        name: stat.Name || existing.name || '',
        destination: stat.Destination || existing.destination || '',
        shipType: stat.Type || existing.shipType || 0,
        imo: stat.ImoNumber || 0,
        callSign: stat.CallSign || '',
        dimA: stat.Dimension?.A || 0,
        dimB: stat.Dimension?.B || 0,
        dimC: stat.Dimension?.C || 0,
        dimD: stat.Dimension?.D || 0,
      });
    }

    if (msgCount % 200 === 0) {
      console.log(`  ${msgCount} messages, ${ships.size} unique ships...`);
    }
  } catch (e) {}
});

// Stop after 3 minutes
setTimeout(() => {
  ws.close();
  console.log(`\nDone. ${msgCount} messages, ${ships.size} unique ships.`);

  // Save raw JSON
  const arr = Array.from(ships.values());
  fs.writeFileSync('/Users/leon/code/hormuz-tracker/baseline-raw.json', JSON.stringify(arr, null, 2));
  console.log(`Saved baseline-raw.json (${(JSON.stringify(arr).length / 1024).toFixed(0)}KB)`);

  // Convert to ship_data.js format for direct use
  const rows = arr.map(s => [
    String(s.lat || 0), String(s.lon || 0),
    String(Math.round((s.sog || 0) * 10)), // speed in 1/10 knots to match HAR format
    String(Math.round(s.cog || 0)),
    '', // heading
    '0', // elapsed (fresh)
    s.destination || '',
    '', // flag (AIS doesn't give flag directly)
    String((s.dimA || 0) + (s.dimB || 0)), // length = dimA + dimB
    s.name || '',
    String(s.shipType || 0),
    s.mmsi,
    String((s.dimC || 0) + (s.dimD || 0)), // width = dimC + dimD
    '', // DWT not in AIS
    '', // type name
    '' // status
  ]);
  const js = 'const D=' + JSON.stringify(rows, null) + ';';
  fs.writeFileSync('/Users/leon/code/hormuz-tracker/baseline-data.js', js);
  console.log(`Saved baseline-data.js (${(js.length / 1024).toFixed(0)}KB) — ${rows.length} ships`);

  process.exit(0);
}, 180000);

ws.on('error', (e) => console.error('WS error:', e.message));
ws.on('close', () => console.log('Connection closed'));
