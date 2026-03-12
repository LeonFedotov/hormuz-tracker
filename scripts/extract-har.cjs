const fs = require('fs');
const path = require('path');

const HAR_PATH = path.resolve(__dirname, '..', 'resouces', 'www.marinetraffic.com-12-mar.11-46.har');
const OUT_PATH = path.resolve(__dirname, '..', 'data', 'ship-positions.json');

console.log('Reading HAR file...');
const har = JSON.parse(fs.readFileSync(HAR_PATH, 'utf8'));

const ships = new Map();
let tiles = 0, errors = 0;

for (const entry of har.log.entries) {
  const url = entry.request.url;
  if (!url.includes('get_data_json')) continue;

  const content = entry.response?.content;
  let text = content?.text || '';
  if (!text) continue;

  if (content.encoding === 'base64') {
    try { text = Buffer.from(text, 'base64').toString('utf-8'); } catch { errors++; continue; }
  }

  let data;
  try { data = JSON.parse(text); } catch { errors++; continue; }

  let rows = [];
  if (data?.data?.rows) rows = data.data.rows;
  else if (data?.rows) rows = data.rows;

  if (rows.length) {
    tiles++;
    for (const r of rows) {
      const sid = r.SHIP_ID || r.MMSI || '';
      if (!sid || ships.has(sid)) continue;

      const spd = r.SPEED ? parseFloat(r.SPEED) / 10 : 0;
      const typeCode = parseInt(r.SHIPTYPE) || 0;
      const typeMap = {7:'cargo',3:'tug',6:'passenger',8:'tanker',2:'fishing',0:'unknown',9:'other',1:'reserved',4:'hsc'};

      ships.set(sid, {
        mmsi: sid,
        name: (r.SHIPNAME || '').trim(),
        flag: r.FLAG || null,
        ship_type: typeMap[typeCode] || 'other',
        ship_type_code: typeCode,
        lat: parseFloat(r.LAT),
        lon: parseFloat(r.LON),
        speed_kn: spd,
        course: r.COURSE ? parseFloat(r.COURSE) : null,
        heading: r.HEADING ? parseFloat(r.HEADING) : null,
        destination: (r.DESTINATION || '').trim() || null,
        length: r.LENGTH ? parseInt(r.LENGTH) : null,
        width: r.WIDTH ? parseInt(r.WIDTH) : null,
        dwt: r.DWT ? parseInt(r.DWT) : null,
        elapsed_sec: parseInt(r.ELAPSED) || 0,
        type_name: (r.TYPE_NAME || '').trim() || null,
        status_name: (r.STATUS_NAME || '').trim() || null,
        source: 'marinetraffic_har',
        timestamp: new Date().toISOString()
      });
    }
  }
}

const arr = Array.from(ships.values());
console.log(`Tiles with data: ${tiles}`);
console.log(`Parse errors: ${errors}`);
console.log(`Unique ships: ${arr.length}`);

// Stats
const lats = arr.map(s => s.lat);
const lons = arr.map(s => s.lon);
console.log(`Lat: ${Math.min(...lats).toFixed(2)} to ${Math.max(...lats).toFixed(2)}`);
console.log(`Lon: ${Math.min(...lons).toFixed(2)} to ${Math.max(...lons).toFixed(2)}`);

const flags = {};
arr.forEach(s => { flags[s.flag || '?'] = (flags[s.flag || '?'] || 0) + 1; });
console.log('\nTop flags:');
Object.entries(flags).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([f,c]) => console.log(`  ${f}: ${c}`));

const types = {};
arr.forEach(s => { types[s.ship_type] = (types[s.ship_type] || 0) + 1; });
console.log('\nTypes:');
Object.entries(types).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => console.log(`  ${t}: ${c}`));

const moving = arr.filter(s => s.speed_kn > 0.5).length;
console.log(`\nMoving: ${moving}, Stopped: ${arr.length - moving}`);

fs.writeFileSync(OUT_PATH, JSON.stringify(arr, null, 2));
console.log(`\nSaved: ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)}KB)`);
