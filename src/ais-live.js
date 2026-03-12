import { CATS } from './ships.js';
import { zoomScale } from './map.js';

import L from 'leaflet';

const MAX_AGE = 30 * 60000, FADE_START = 5 * 60000;
function ageOp(ts) {
  const a = Date.now() - ts;
  if (a < FADE_START) return 0.9; if (a > MAX_AGE) return 0;
  return 0.9 * (1 - (a - FADE_START) / (MAX_AGE - FADE_START));
}

function liveCat(type) {
  if (type >= 80 && type <= 89) return 'tanker';
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 35 && type <= 39) return 'military';
  return 'other';
}
function liveCol(cat) { return cat === 'tanker' ? '#e66' : cat === 'cargo' ? '#4a8' : cat === 'military' ? '#f0f' : '#06b6d4'; }

export function initAisLive(map, apiKey) {
  const liveShips = new Map();
  const liveLayer = L.layerGroup().addTo(map);
  const trailLayer = L.layerGroup().addTo(map);
  const canvasRenderer = L.canvas();
  const aisState = { connected: false, msgCount: 0, shipCount: 0 };

  // IndexedDB for track persistence
  const DB_NAME = 'hormuz-tracks';
  let db = null;
  (function initDB() {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('positions')) {
        const s = d.createObjectStore('positions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('mmsi', 'mmsi'); s.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = e => { db = e.target.result; };
  })();

  function storePos(mmsi, lat, lon, ts) {
    if (!db) return;
    const tx = db.transaction('positions', 'readwrite');
    tx.objectStore('positions').add({ mmsi, lat, lon, ts });
  }

  // Purge >24h every 5 min
  setInterval(() => {
    if (!db) return;
    const cut = Date.now() - 24 * 3600000;
    const tx = db.transaction('positions', 'readwrite');
    const idx = tx.objectStore('positions').index('ts');
    idx.openCursor(IDBKeyRange.upperBound(cut)).onsuccess = e => {
      const c = e.target.result; if (c) { c.delete(); c.continue(); }
    };
  }, 300000);

  function processLiveBatch(batch) {
    batch.forEach(d => {
      const { mmsi, lat, lon, sog, cog, name, shipType, destination, ts } = d;
      const cat = liveCat(shipType);
      const col = liveCol(cat);

      storePos(mmsi, lat, lon, ts);

      let ship = liveShips.get(mmsi);
      const isMoving = sog > 0.5;
      const sc = zoomScale(map);
      if (!ship) {
        const m = isMoving
          ? new L.TriangleMarker([lat, lon], { radius: 5 * sc, rotation: cog, fillColor: col, fillOpacity: 0.9, color: '#fff', weight: 1.2 })
          : L.circleMarker([lat, lon], { radius: 4 * sc, fillColor: col, fillOpacity: 0.9, color: '#fff', weight: 1 });
        m.bindPopup('');
        liveLayer.addLayer(m);
        ship = { lat, lon, sog, cog, name: name || 'MMSI:' + mmsi, cat, dest: destination, ts, type: shipType, m, trail: null, pts: [[lat, lon]], isTriangle: isMoving };
        liveShips.set(mmsi, ship);
      } else {
        ship.pts.push([lat, lon]);
        if (ship.pts.length > 200) ship.pts = ship.pts.slice(-200);
        Object.assign(ship, { lat, lon, sog, cog, ts, cat, type: shipType });
        if (name) ship.name = name;
        if (destination) ship.dest = destination;
        ship.m.setLatLng([lat, lon]);
        ship.m.setStyle({ fillColor: col, fillOpacity: 0.9 });
        if (ship.m.options.rotation !== undefined) ship.m.options.rotation = cog;
        if (ship.trail) trailLayer.removeLayer(ship.trail);
        if (ship.pts.length > 1) {
          ship.trail = L.polyline(ship.pts, { color: col, weight: 1.5, opacity: 0.4, renderer: canvasRenderer }).addTo(trailLayer);
        }
      }
      ship.m.setPopupContent(
        `<div class="pn">${ship.name}</div>` +
        `<div class="pc" style="background:${col}22;color:${col};border:1px solid ${col}44">LIVE · ${cat}</div>` +
        `<div class="pr"><span class="pl">Speed</span><span class="pv">${sog.toFixed(1)} kn</span></div>` +
        `<div class="pr"><span class="pl">Course</span><span class="pv">${cog.toFixed(0)}&deg;</span></div>` +
        (ship.dest ? `<div class="pr"><span class="pl">Dest</span><span class="pv">${ship.dest}</span></div>` : '') +
        `<div class="pr"><span class="pl">MMSI</span><span class="pv">${mmsi}</span></div>` +
        `<div class="pr"><span class="pl">Track</span><span class="pv">${ship.pts.length} pts</span></div>`
      );
    });
    aisState.msgCount += batch.length;
    aisState.shipCount = liveShips.size;
    updateAisStatus();
  }

  // Age out stale live ships every 15s
  setInterval(() => {
    liveShips.forEach((ship, mmsi) => {
      const op = ageOp(ship.ts);
      if (op <= 0) {
        liveLayer.removeLayer(ship.m);
        if (ship.trail) trailLayer.removeLayer(ship.trail);
        liveShips.delete(mmsi);
      } else {
        ship.m.setStyle({ fillOpacity: op });
        if (ship.trail) ship.trail.setStyle({ opacity: op * 0.5 });
      }
    });
    aisState.shipCount = liveShips.size;
    updateAisStatus();
  }, 15000);

  function updateAisStatus() {
    const el = document.getElementById('aisStatus');
    if (!el) return;
    el.innerHTML = aisState.connected
      ? `<span style="color:#4a8">LIVE</span> ${aisState.shipCount} ships · ${aisState.msgCount} msgs`
      : `<span style="color:#f66">CONNECTING...</span>`;
  }

  function getBBox() {
    const b = map.getBounds();
    return [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
  }

  const aisWorker = new Worker('/ais-worker.js');
  aisWorker.onmessage = e => {
    const msg = e.data;
    if (msg.type === 'batch') processLiveBatch(msg.ships);
    else if (msg.type === 'status') {
      aisState.connected = msg.connected;
      updateAisStatus();
    }
    else if (msg.type === 'static') {
      const ship = liveShips.get(msg.mmsi);
      if (ship) {
        if (msg.name) ship.name = msg.name;
        if (msg.destination) ship.dest = msg.destination;
        if (msg.shipType) { ship.type = msg.shipType; ship.cat = liveCat(msg.shipType); }
      }
    }
  };

  // DISABLED: live AIS while working on UI. Uncomment to re-enable:
  // aisWorker.postMessage({type:'init',apiKey,bbox:getBBox()});
  document.getElementById('aisStatus').innerHTML = '<span style="color:var(--fg-dim)">PAUSED</span> — using cached data';

  // Update bbox on map move (debounced)
  let aisBboxTimer;
  map.on('moveend', () => {
    clearTimeout(aisBboxTimer);
    aisBboxTimer = setTimeout(() => { aisWorker.postMessage({ type: 'bbox', bbox: getBBox() }); }, 1000);
  });

  // Time range control
  let harLayerRef = null;
  function setHarLayer(layer) { harLayerRef = layer; }

  function setTimeRange(val) {
    if (val === 'har') {
      if (harLayerRef) map.addLayer(harLayerRef);
    } else {
      if (harLayerRef) map.removeLayer(harLayerRef);
      if (val !== 'live' && db) {
        const hours = { '1h': 1, '6h': 6, '24h': 24 }[val] || 1;
        const cutoff = Date.now() - hours * 3600000;
        const tx = db.transaction('positions', 'readonly');
        const idx = tx.objectStore('positions').index('ts');
        const range = IDBKeyRange.lowerBound(cutoff);
        const histPositions = new Map();
        idx.openCursor(range).onsuccess = e => {
          const c = e.target.result;
          if (c) {
            const d = c.value;
            if (!histPositions.has(d.mmsi)) histPositions.set(d.mmsi, []);
            histPositions.get(d.mmsi).push([d.lat, d.lon, d.ts]);
            c.continue();
          } else {
            trailLayer.clearLayers();
            histPositions.forEach((pts) => {
              if (pts.length > 1) {
                pts.sort((a, b) => a[2] - b[2]);
                const coords = pts.map(p => [p[0], p[1]]);
                L.polyline(coords, { color: '#888', weight: 1, opacity: 0.3, renderer: canvasRenderer }).addTo(trailLayer);
                const last = pts[pts.length - 1];
                L.circleMarker([last[0], last[1]], {
                  radius: 3, fillColor: '#888', fillOpacity: 0.5, color: '#888', weight: 0,
                }).addTo(trailLayer);
              }
            });
          }
        };
      }
    }
  }

  return { liveShips, liveLayer, trailLayer, setTimeRange, setHarLayer, aisState };
}
