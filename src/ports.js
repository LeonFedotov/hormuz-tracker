import { CATS, shipPopup } from './ships.js';
import { zoomScale } from './map.js';

import L from 'leaflet';

export const PORTS = [
  [27.18, 56.28, 'Bandar Abbas', 'ir', 'Shahid Rajaee — Iran\'s largest container port'],
  [27.50, 52.59, 'Bushehr', 'ir', 'Bushehr Port — Iranian naval base'],
  [30.44, 49.08, 'Khorramshahr', 'ir', 'Khorramshahr — Shatt al-Arab waterway'],
  [27.13, 56.07, 'Larak Island', 'ir', 'Larak — oil terminal, tanker anchorage'],
  [25.12, 56.33, 'Fujairah', 'uae', 'Fujairah — bunkering hub, STS transfers'],
  [25.27, 55.28, 'Dubai / Jebel Ali', 'uae', 'Jebel Ali — largest Middle East port'],
  [25.35, 56.35, 'Khor Fakkan', 'uae', 'Khor Fakkan — UAE east coast container port'],
  [24.45, 54.65, 'Abu Dhabi', 'uae', 'Abu Dhabi / Mussafah ports'],
  [23.63, 58.57, 'Muscat', 'om', 'Port Sultan Qaboos'],
  [24.37, 56.73, 'Sohar', 'om', 'Sohar Industrial Port — Oman'],
  [23.01, 57.05, 'Duqm', 'om', 'Duqm — new deepwater port, UK naval base'],
  [26.19, 50.20, 'Bahrain / Sitra', 'bh', 'Sitra oil terminal — Bahrain'],
  [25.28, 51.53, 'Doha', 'qa', 'Doha — Qatar'],
  [25.37, 51.15, 'Ras Laffan', 'qa', 'Ras Laffan — world\'s largest LNG port'],
  [29.37, 47.95, 'Kuwait City', 'kw', 'Shuwaikh / Shuaiba ports'],
  [26.47, 50.10, 'Dammam', 'sa', 'King Abdulaziz Port — Saudi Arabia'],
  [26.64, 50.17, 'Ras Tanura', 'sa', 'Ras Tanura — largest oil terminal in the world'],
  [22.98, 57.54, 'Khasab', 'om', 'Musandam — Oman exclave, Strait narrows'],
  // Red Sea / Suez
  [29.95, 32.56, 'Suez', 'eg', 'Suez Canal southern entrance'],
  [31.26, 32.31, 'Port Said', 'eg', 'Suez Canal northern entrance — Mediterranean gateway'],
  [21.49, 39.17, 'Jeddah', 'sa', 'Jeddah Islamic Port — Saudi Red Sea hub'],
  [24.09, 38.07, 'Yanbu', 'sa', 'Yanbu — East-West Pipeline Red Sea terminal'],
  [12.78, 45.02, 'Aden', 'ye', 'Port of Aden — Bab el-Mandeb approach'],
  [12.60, 43.15, 'Djibouti', 'dj', 'Djibouti — US/France/China naval bases'],
  [19.62, 37.22, 'Port Sudan', 'sd', 'Port Sudan — Red Sea hub'],
  [15.35, 42.95, 'Hodeidah', 'ye', 'Hodeidah — Yemen Red Sea port (Houthi-controlled)'],
  // Caspian Sea
  [37.50, 49.46, 'Bandar Anzali', 'ir', 'Iran\'s main Caspian port — oil/cargo'],
  [36.85, 53.06, 'Amirabad', 'ir', 'Amirabad — Iran Caspian oil terminal'],
  [40.37, 49.85, 'Baku', 'az', 'Baku — Azerbaijan oil hub, BTC pipeline origin'],
  [41.64, 50.01, 'Aktau', 'kz', 'Aktau — Kazakhstan Caspian oil terminal'],
  [39.95, 53.00, 'Turkmenbashi', 'tm', 'Turkmenbashi — Turkmenistan oil/gas port'],
  [42.07, 47.10, 'Makhachkala', 'ru', 'Makhachkala — Russia Caspian port'],
];

const PORT_COL = { ir:'#818cf8', uae:'#10b981', sa:'#f59e0b', om:'#06b6d4', bh:'#f59e0b', qa:'#f59e0b', kw:'#f59e0b',
  eg:'#f97316', ye:'#ef4444', dj:'#6b7280', sd:'#6b7280', az:'#06b6d4', kz:'#06b6d4', tm:'#06b6d4', ru:'#6b7280' };

export function initPorts(map, ships, getCurTheme, linkLayer) {
  const portLayer = L.layerGroup().addTo(map);
  const portMarkers = [];

  PORTS.forEach(([lat, lon, name, cc, desc]) => {
    const col = PORT_COL[cc] || '#888';
    const m = new L.DiamondMarker([lat, lon], {
      radius: 6, interactive: true,
      fillColor: col, fillOpacity: 0.85, color: '#fff', weight: 2, opacity: 1,
    });
    m.bindPopup(`<div class="pn">${name}</div><div style="font-size:10px;color:var(--fg-dim)">${desc}</div><div id="port-link-count" style="margin-top:4px;font-size:11px;color:var(--fg-accent)"></div>`);
    m.on('popupopen', () => {
      const r = showPortLinks(linkLayer, ships, name, lat, lon, getCurTheme);
      const el = document.getElementById('port-link-count');
      if (el && r) el.innerHTML = `<strong>${r.total}</strong> vessels linked` +
        (r.headed ? ` · <span style="color:#4a8">${r.headed} underway</span>` : '') +
        (r.stranded ? ` · <span style="color:#ef4444">${r.stranded} stranded</span>` : '');
    });
    m.bindTooltip(name, { permanent: false, direction: 'right', offset: [10, 0], className: 'port-label', interactive: false });
    portLayer.addLayer(m);
    portMarkers.push(m);
  });

  // Zone overlays
  L.circle([26.23, 56.37], { radius: 5000, color: '#fa0', fillOpacity: 0.02, weight: 1, dashArray: '6,4', interactive: false }).addTo(map);
  L.circle([26.08, 56.08], { radius: 5000, color: '#f60', fillOpacity: 0.02, weight: 1, dashArray: '6,4', interactive: false }).addTo(map);

  // Clear links when popup closes
  map.on('popupclose', () => { linkLayer.clearLayers(); });

  return { portLayer, portMarkers };
}

function showPortLinks(linkLayer, ships, portName, portLat, portLon, getCurTheme) {
  linkLayer.clearLayers();
  const normalizedPort = portName.toUpperCase();
  const linked = ships.filter(s => {
    if (!s.dest) return false;
    const d = s.dest.toUpperCase();
    if (normalizedPort.includes('BANDAR ABBAS') || normalizedPort.includes('SHAHID'))
      return /BND|BANDAR|B\.ABBAS|B ABBAS|RAJAEE|IRBND|IR BND/.test(d);
    if (normalizedPort.includes('FUJAIRAH'))
      return /FUJAIRAH|FUJEIRAH/.test(d);
    if (normalizedPort.includes('JEBEL ALI') || normalizedPort.includes('DUBAI'))
      return /DUBAI|DUBAY|J\.ALI|JEBEL|HAMRYH|HAMRIYAH/.test(d);
    if (normalizedPort.includes('MUSCAT'))
      return /MUSCAT/.test(d);
    if (normalizedPort.includes('SOHAR'))
      return /SOHAR/.test(d);
    if (normalizedPort.includes('BAHRAIN') || normalizedPort.includes('SITRA'))
      return /BAHRAIN|SITRA/.test(d);
    if (normalizedPort.includes('DOHA'))
      return /DOHA|QATAR/.test(d);
    if (normalizedPort.includes('RAS LAFFAN'))
      return /RAS LAFFAN/.test(d);
    if (normalizedPort.includes('DAMMAM'))
      return /DAMMAM/.test(d);
    if (normalizedPort.includes('RAS TANURA'))
      return /RAS TANURA/.test(d);
    if (normalizedPort.includes('KUWAIT'))
      return /KUWAIT|SHUWAIKH|SHUAIBA/.test(d);
    if (normalizedPort.includes('KHOR FAKKAN'))
      return /KHOR FAKKAN/.test(d);
    if (normalizedPort.includes('ABU DHABI'))
      return /ABU DHABI|MUSSAFAH/.test(d);
    if (normalizedPort.includes('BUSHEHR'))
      return /BUSHEHR/.test(d);
    if (normalizedPort.includes('KHORRAMSHAHR'))
      return /KHORAMSHAHR|KHORRAMSHAHR/.test(d);
    return d.includes(normalizedPort.split('/')[0].split(' —')[0].trim());
  });

  const headed = linked.filter(s => s.spd > 0.5);
  const stranded = linked.filter(s => s.spd <= 0.5);

  headed.forEach(s => {
    const col = CATS[s.cat].c;
    const line = L.polyline([[s.lat, s.lon], [portLat, portLon]], {
      color: col, weight: 2, opacity: 0.6, dashArray: '8,4', interactive: true,
    }).addTo(linkLayer);
    line.bindPopup(() => shipPopup(s, getCurTheme()), { maxWidth: 240 });
    const dot = L.circleMarker([s.lat, s.lon], {
      radius: 7, fillColor: col, fillOpacity: 0.9, color: '#fff', weight: 2, interactive: true,
    }).addTo(linkLayer);
    dot.bindPopup(() => shipPopup(s, getCurTheme()), { maxWidth: 240 });
  });

  stranded.forEach(s => {
    const line = L.polyline([[s.lat, s.lon], [portLat, portLon]], {
      color: '#ef4444', weight: 1.5, opacity: 0.4, dashArray: '3,6', interactive: true,
    }).addTo(linkLayer);
    line.bindPopup(() => '<div style="font-size:11px"><strong>' + s.name + '</strong> — <span style="color:#ef4444">STRANDED</span><br>Destination: ' + s.dest + '<br>Speed: 0 kn — stationary with destination set</div>', { maxWidth: 240 });
    const dot = L.circleMarker([s.lat, s.lon], {
      radius: 6, fillColor: '#ef4444', fillOpacity: 0.7, color: '#fff', weight: 1.5, interactive: true,
    }).addTo(linkLayer);
    dot.bindPopup(() => shipPopup(s, getCurTheme()), { maxWidth: 240 });
  });

  return { headed: headed.length, stranded: stranded.length, total: linked.length };
}

export function findDestPort(dest) {
  if (!dest) return null;
  const d = dest.toUpperCase();
  const match = PORTS.find(([, , name]) => {
    const n = name.toUpperCase();
    if (n.includes('BANDAR ABBAS') && /BND|BANDAR|B\.ABBAS|B ABBAS|RAJAEE|IRBND|IR BND/.test(d)) return true;
    if (n.includes('FUJAIRAH') && /FUJAIRAH|FUJEIRAH/.test(d)) return true;
    if ((n.includes('JEBEL ALI') || n.includes('DUBAI')) && /DUBAI|DUBAY|J\.ALI|JEBEL|HAMRYH|HAMRIYAH/.test(d)) return true;
    if (n.includes('MUSCAT') && /MUSCAT/.test(d)) return true;
    if (n.includes('SOHAR') && /SOHAR/.test(d)) return true;
    if (n.includes('KHOR FAKKAN') && /KHOR FAKKAN/.test(d)) return true;
    if (n.includes('ABU DHABI') && /ABU DHABI|MUSSAFAH/.test(d)) return true;
    if ((n.includes('BAHRAIN') || n.includes('SITRA')) && /BAHRAIN|SITRA/.test(d)) return true;
    if (n.includes('DOHA') && /DOHA|QATAR/.test(d)) return true;
    if (n.includes('RAS LAFFAN') && /RAS LAFFAN/.test(d)) return true;
    if (n.includes('DAMMAM') && /DAMMAM/.test(d)) return true;
    if (n.includes('RAS TANURA') && /RAS TANURA/.test(d)) return true;
    if (n.includes('KUWAIT') && /KUWAIT|SHUWAIKH|SHUAIBA/.test(d)) return true;
    if (n.includes('BUSHEHR') && /BUSHEHR/.test(d)) return true;
    if (n.includes('KHORRAMSHAHR') && /KHORAMSHAHR|KHORRAMSHAHR/.test(d)) return true;
    return false;
  });
  return match ? { lat: match[0], lon: match[1], name: match[2] } : null;
}

export function showShipToPort(s, linkLayer, map) {
  linkLayer.clearLayers();
  const port = findDestPort(s.dest);
  if (!port) return;
  const col = CATS[s.cat].c;
  L.polyline([[s.lat, s.lon], [port.lat, port.lon]], {
    color: col, weight: 2, opacity: 0.6, dashArray: '8,4',
  }).addTo(linkLayer);
  // Highlight the destination port with a ring (no popup — that would close the ship popup and trigger clearLayers)
  L.circleMarker([port.lat, port.lon], {
    radius: 10, fillColor: col, fillOpacity: 0.3, color: col, weight: 2,
  }).addTo(linkLayer).bindTooltip(port.name, { permanent: true, direction: 'right', offset: [12, 0], className: 'port-label', interactive: false });
}
