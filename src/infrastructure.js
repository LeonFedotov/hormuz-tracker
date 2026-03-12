import { zoomScale } from './map.js';

import L from 'leaflet';

const INFRA_DATA = [
  { name: "Kharg Island", lat: 29.23, lon: 50.32, type: "oil_terminal", country: "IR", status: "destroyed", notes: "90% of Iran oil exports — 7 oil jetties confirmed destroyed" },
  { name: "Lavan Island", lat: 26.80, lon: 53.36, type: "oil_terminal", country: "IR", status: "unknown" },
  { name: "Sirri Island", lat: 25.89, lon: 54.55, type: "oil_terminal", country: "IR", status: "unknown" },
  { name: "Abadan Refinery", lat: 30.34, lon: 48.28, type: "refinery", country: "IR", status: "unknown", notes: "Iran's oldest, 400k bbl/day capacity" },
  { name: "Isfahan Refinery", lat: 32.62, lon: 51.66, type: "refinery", country: "IR", status: "unknown" },
  { name: "Assaluyeh / South Pars", lat: 27.47, lon: 52.61, type: "gas_terminal", country: "IR", status: "unknown", notes: "South Pars gas field shore terminal" },
  { name: "Jask Oil Terminal", lat: 25.65, lon: 57.77, type: "oil_terminal", country: "IR", status: "unknown", notes: "Bypass terminal outside Hormuz — strategic" },
  { name: "Bandar Abbas Refinery", lat: 27.20, lon: 56.22, type: "refinery", country: "IR", status: "damaged", notes: "Struck — extent of damage under assessment" },
  { name: "ADNOC Ruwais", lat: 24.11, lon: 52.73, type: "refinery", country: "AE", status: "unknown" },
  { name: "Habshan-Fujairah Pipeline", lat: 25.12, lon: 56.33, type: "pipeline_terminal", country: "AE", status: "unknown", notes: "1.5M bbl/day bypass pipeline, exits at Fujairah (outside Hormuz)" },
  { name: "East-West Pipeline (Petroline)", lat: 26.47, lon: 50.10, type: "pipeline_terminal", country: "SA", status: "unknown", notes: "5M bbl/day Abqaiq→Yanbu, bypasses Hormuz entirely" },
];

const INFRA_STATUS_COL = { operational: '#22c55e', degraded: '#eab308', damaged: '#ef4444', destroyed: '#111', unknown: '#6b7280' };
const INFRA_TYPE_LABEL = { oil_terminal: 'Oil Terminal', refinery: 'Refinery', gas_terminal: 'Gas Terminal', pipeline_terminal: 'Pipeline Terminal' };
const INFRA_COUNTRY = { IR: 'Iran', AE: 'UAE', SA: 'Saudi Arabia', QA: 'Qatar', OM: 'Oman', KW: 'Kuwait', BH: 'Bahrain' };

export function initInfrastructure(map) {
  const infraLayer = L.layerGroup().addTo(map);
  const infraMarkers = [];
  const sc = zoomScale(map);

  INFRA_DATA.forEach(f => {
    const col = INFRA_STATUS_COL[f.status] || '#6b7280';
    let m;
    if (f.type === 'oil_terminal') {
      m = L.circleMarker([f.lat, f.lon], {
        radius: 7, interactive: true, fillColor: col, fillOpacity: 0.25, color: col, weight: 2.5, opacity: 0.9, interactive: true,
      });
    } else if (f.type === 'refinery') {
      m = new L.SquareMarker([f.lat, f.lon], {
        radius: 6, interactive: true, fillColor: col, fillOpacity: 0.3, color: col, weight: 2.5, opacity: 0.9,
      });
    } else if (f.type === 'gas_terminal') {
      m = new L.HexMarker([f.lat, f.lon], {
        radius: 7, interactive: true, fillColor: col, fillOpacity: 0.3, color: col, weight: 2.5, opacity: 0.9,
      });
    } else {
      m = new L.PillMarker([f.lat, f.lon], {
        radius: 5, interactive: true, fillColor: col, fillOpacity: 0.3, color: col, weight: 2.5, opacity: 0.9,
      });
    }
    const statusTag = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;background:${col}22;color:${col};border:1px solid ${col}44">${f.status.toUpperCase()}</span>`;
    m.bindPopup(
      `<div class="pn">${f.name}</div>` +
      `<div style="margin:3px 0">${statusTag} <span style="font-size:10px;color:var(--fg-dim)">${INFRA_TYPE_LABEL[f.type] || f.type}</span></div>` +
      `<div class="pr"><span class="pl">Country</span><span class="pv">${INFRA_COUNTRY[f.country] || f.country}</span></div>` +
      (f.notes ? `<div style="margin-top:4px;padding:3px 5px;background:var(--bg-bar);border-radius:3px;font-size:10px;color:var(--fg-dim)">${f.notes}</div>` : ''),
      { maxWidth: 260 }
    );
    m.bindTooltip(f.name, { permanent: false, direction: 'right', offset: [10, 0], className: 'port-label', interactive: false });
    infraLayer.addLayer(m);
    infraMarkers.push(m);
    if (f.type === 'oil_terminal') {
      const inner = L.circleMarker([f.lat, f.lon], {
        radius: 3, interactive: true, fillColor: col, fillOpacity: 0.9, color: 'none', weight: 0, interactive: false,
      });
      infraLayer.addLayer(inner);
      infraMarkers.push(inner);
    }
  });

  return { infraLayer, infraMarkers };
}
