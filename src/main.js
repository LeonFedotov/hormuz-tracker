import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';

import L from 'leaflet';
import { initMap, zoomScale } from './map.js';
import { initTheme, getCurTheme } from './theme.js';
import { parseShips, CATS, shipPopup, shipBaseRadius } from './ships.js';
import { initPorts, showShipToPort } from './ports.js';
import { initInfrastructure } from './infrastructure.js';
import { initIncidents } from './incidents.js';
import { initCrisisWidget } from './crisis-widget.js';
import { renderDashboard, initDashboardControls } from './dashboard.js';
import { renderAnalysis, startAnalysisRefresh } from './analysis.js';
import { initTable, initTableControls } from './table.js';
import { initResize } from './resize.js';
import { initAisLive } from './ais-live.js';
import { fmt } from './utils.js';

const shipData = await fetch('/data/ship-positions.json').then(r => r.json()).catch(() => []);
const ships = parseShips(shipData);

// ====== MAP ======
const { map, tileLayer } = initMap();
initTheme(map, tileLayer);

// ====== RENDER SHIPS (HAR layer) ======
const linkLayer = L.layerGroup().addTo(map); // ship-port lines, created early so ship popups can use it
const harLayer = L.layerGroup().addTo(map);
const markers = [];
const markerById = Object.create(null);

ships.forEach(s => {
  const col = CATS[s.cat].c;
  const op = s.sat ? 0.25 : (s.el > 600 ? 0.4 : 0.85);
  const isMoving = s.spd > 0.5 && s.crs !== null;
  const r = shipBaseRadius(s) * zoomScale(map);

  let m;
  if (isMoving && !s.sat) {
    m = new L.TriangleMarker([s.lat, s.lon], {
      radius: r, rotation: s.crs, interactive: true,
      fillColor: col, fillOpacity: op, color: col, weight: 0.8, opacity: op,
    });
  } else {
    m = L.circleMarker([s.lat, s.lon], {
      radius: r * (s.sat ? 0.7 : 0.85), interactive: true,
      fillColor: col, fillOpacity: op, color: s.cat === 'STRANDED' ? col : '#000',
      weight: s.cat === 'STRANDED' ? 1.5 : 0.3, opacity: op,
    });
  }
  m.bindPopup(() => shipPopup(s, getCurTheme()), { maxWidth: 240 });
  m.on('popupopen', () => showShipToPort(s, linkLayer, map));
  harLayer.addLayer(m);
  const entry = { s, m, base: shipBaseRadius(s) };
  markers.push(entry);
  markerById[s.id] = entry;
});

// ====== PORTS ======
const { portLayer, portMarkers } = initPorts(map, ships, getCurTheme, linkLayer);

// ====== INFRASTRUCTURE ======
const { infraLayer, infraMarkers } = initInfrastructure(map);

// ====== INCIDENTS ======
const { incidentLayer, incidentMarkers } = initIncidents(map);

// Scale icons with the map — geographic sizing
map.on('zoomend', () => {
  const sc = zoomScale(map);
  markers.forEach(({ m, base }) => m.setRadius(Math.max(1, base * sc)));
  portMarkers.forEach(m => m.setRadius(Math.max(2, 6 * sc)));
});

// Speed vectors at zoom 6+
const vectorLayer = L.layerGroup().addTo(map);
function updateVectors() {
  vectorLayer.clearLayers();
  if (map.getZoom() < 6) return;
  const b = map.getBounds();
  const sc = map.getZoom() >= 8 ? 0.002 : 0.001;
  ships.filter(s => s.spd > 1 && s.crs !== null && !s.sat && b.contains([s.lat, s.lon])).forEach(s => {
    const l = s.spd * sc, r = s.crs * Math.PI / 180;
    L.polyline([[s.lat, s.lon], [s.lat - l * Math.cos(r), s.lon - l * Math.sin(r)]],
      { color: CATS[s.cat].c, weight: 1.5, opacity: .25, dashArray: '2,4', interactive: false }).addTo(vectorLayer);
  });
}
map.on('moveend', updateVectors);
setTimeout(updateVectors, 100);

// ====== CRISIS WIDGET ======
initCrisisWidget();

// ====== COMPUTE STATS ======
const id = ships.filter(s => !s.sat);
const cc = {};
Object.keys(CATS).forEach(k => { cc[k] = ships.filter(s => s.cat === k); });
const dwtBy = {};
Object.keys(CATS).forEach(k => { dwtBy[k] = cc[k].reduce((a, s) => a + s.dwt, 0); });

// ====== PANELS ======
renderDashboard(ships, cc, dwtBy, id);
initDashboardControls(map, { infra: infraLayer, incidents: incidentLayer, ports: portLayer });
renderAnalysis(ships, cc, dwtBy, id);
startAnalysisRefresh(ships, cc, dwtBy, id);

// ====== TABLE ======
const table = initTable(ships, map, markerById);
initTableControls(table, map);

// ====== RESIZE ======
initResize(map);

// ====== AIS LIVE ======
const aisKey = import.meta.env.VITE_AIS_KEY || '';
const ais = initAisLive(map, aisKey);
ais.setHarLayer(harLayer);

// Expose setTimeRange globally for the <select> onchange
window.setTimeRange = ais.setTimeRange;

// ====== LIMITED DATA WARNING ======
if (ships.length < 10) {
  const warn = document.createElement('div');
  warn.className = 'limited-data-warning';
  warn.textContent = 'Limited AIS data — Gulf shipping at 95% collapse';
  document.getElementById('map').appendChild(warn);
}

// ====== FOOTER INFO ======
document.getElementById('ts').textContent = 'AIS live · ' + ships.length + ' vessels · ' + new Date().toISOString().replace('T', ' ').slice(0, 16);
document.getElementById('subTitle').textContent = ships.length.toLocaleString() + ' vessels · Persian Gulf, Red Sea, Caspian Sea, Arabian Sea';
