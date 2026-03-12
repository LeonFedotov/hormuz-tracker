import D from '../src/ship-data.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'data');
mkdirSync(outDir, { recursive: true });

// Ship type code mapping (MarineTraffic codes)
const SHIP_TYPE_MAP = {
  '1': 'other', '2': 'other', '3': 'other', '4': 'other',
  '5': 'other', '6': 'passenger', '7': 'cargo', '8': 'tanker',
  '9': 'other'
};

const FIELDS = [
  'lat', 'lon', 'speed_tenth_kn', 'course', 'heading',
  'elapsed', 'dest', 'flag', 'length', 'name',
  'shiptype', 'ship_id', 'width', 'dwt', 'type_name', 'status_name'
];

const now = new Date().toISOString();

const ships = D.map(entry => {
  const raw = {};
  FIELDS.forEach((key, i) => {
    const val = entry[i];
    if (val === null || val === undefined || val === '') {
      raw[key] = null;
      return;
    }
    if (['lat', 'lon'].includes(key)) {
      raw[key] = parseFloat(val);
    } else if (['speed_tenth_kn', 'course', 'heading', 'elapsed', 'length', 'width', 'dwt'].includes(key)) {
      const n = parseFloat(val);
      raw[key] = isNaN(n) ? null : n;
    } else {
      raw[key] = val;
    }
  });

  // Normalize type_name from HAR (some have it, most don't)
  let shipType = raw.type_name || SHIP_TYPE_MAP[raw.shiptype] || 'other';
  // Clean up MarineTraffic type names
  if (shipType.includes('Tanker')) shipType = 'tanker';
  else if (shipType.includes('Cargo')) shipType = 'cargo';
  else if (shipType.includes('Passenger')) shipType = 'passenger';
  else if (shipType.includes('Tug')) shipType = 'tug';
  else if (shipType.includes('Military')) shipType = 'military';

  return {
    mmsi: null, // HAR data doesn't include MMSI
    name: raw.name,
    flag: raw.flag,
    ship_type: shipType,
    lat: raw.lat,
    lon: raw.lon,
    speed_kn: raw.speed_tenth_kn !== null ? raw.speed_tenth_kn / 10 : null,
    course: raw.course,
    heading: raw.heading,
    destination: raw.dest,
    length: raw.length,
    width: raw.width,
    dwt: raw.dwt,
    status: raw.status_name || null,
    timestamp: now,
    source: 'marinetraffic_har',
    mt_ship_id: raw.ship_id
  };
});

// Merge AIS live data if available
const aisPath = join(outDir, 'ais-live.json');
if (existsSync(aisPath)) {
  try {
    const aisShips = JSON.parse(readFileSync(aisPath, 'utf-8'));
    let merged = 0;
    for (const ais of aisShips) {
      // Try to match by name, otherwise add as new
      const match = ships.find(s =>
        s.name && ais.name && s.name.toUpperCase() === ais.name.toUpperCase()
      );
      if (match) {
        match.mmsi = ais.mmsi;
        match.lat = ais.lat;
        match.lon = ais.lon;
        match.speed_kn = ais.speed_kn;
        match.course = ais.course;
        match.heading = ais.heading;
        match.timestamp = ais.timestamp;
        match.source = 'aisstream_live';
        merged++;
      } else {
        ships.push({
          mmsi: ais.mmsi,
          name: ais.name,
          flag: null,
          ship_type: 'other',
          lat: ais.lat,
          lon: ais.lon,
          speed_kn: ais.speed_kn,
          course: ais.course,
          heading: ais.heading,
          destination: null,
          length: null,
          width: null,
          dwt: null,
          status: null,
          timestamp: ais.timestamp,
          source: 'aisstream_live',
          mt_ship_id: null
        });
      }
    }
    console.log(`Merged ${merged} AIS updates, added ${aisShips.length - merged} new AIS vessels`);
  } catch (e) {
    console.log('Could not merge AIS data:', e.message);
  }
}

const outPath = join(outDir, 'ship-positions.json');
writeFileSync(outPath, JSON.stringify(ships, null, 2));
console.log(`Wrote ${ships.length} ships to ${outPath}`);
