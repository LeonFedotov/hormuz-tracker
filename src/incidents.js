import { zoomScale } from './map.js';

import L from 'leaflet';

function incidentAgeColor(ts) {
  const h = (Date.now() - ts) / 3600000;
  if (h < 1) return { col: '#ef4444', op: 0.95 };
  if (h < 6) return { col: '#f97316', op: 0.85 };
  if (h < 24) return { col: '#eab308', op: 0.7 };
  return { col: '#6b7280', op: 0.5 };
}

function incidentPopup(ev) {
  const age = Date.now() - ev.timestamp;
  const agoStr = age < 3600000 ? Math.round(age / 60000) + 'm ago' : age < 86400000 ? Math.round(age / 3600000) + 'h ago' : Math.round(age / 86400000) + 'd ago';
  const confCol = { high: '#22c55e', medium: '#eab308', low: '#f97316' }[ev.confidence] || '#6b7280';
  const typeLabel = { incident: 'Incident', military_sighting: 'Military Sighting', news: 'News Report' }[ev.type] || ev.type;
  let h = `<div class="pn">${ev.title}</div>`;
  h += `<div style="display:flex;gap:6px;align-items:center;margin:3px 0">`;
  h += `<span class="pc" style="background:${confCol}22;color:${confCol};border:1px solid ${confCol}44">${typeLabel}</span>`;
  h += `<span style="font-size:9px;color:var(--fg-dim)">${ev.source} · ${agoStr}</span>`;
  h += `</div>`;
  if (ev.description) h += `<div style="font-size:10px;color:var(--fg-dim);margin:3px 0">${ev.description.slice(0, 200)}${ev.description.length > 200 ? '...' : ''}</div>`;
  h += `<div class="pr"><span class="pl">Confidence</span><span class="pv" style="color:${confCol}">${ev.confidence}</span></div>`;
  if (ev.data && ev.data.location) h += `<div class="pr"><span class="pl">Location</span><span class="pv">${ev.data.location}</span></div>`;
  if (ev.url) h += `<div style="margin-top:4px"><a href="${ev.url}" target="_blank" rel="noopener" style="font-size:10px;color:var(--fg-accent)">View source &rarr;</a></div>`;
  return h;
}

function renderIncidents(allEvents, incidentLayer, incidentMarkers, map) {
  incidentLayer.clearLayers();
  incidentMarkers.length = 0;
  const withCoords = allEvents.filter(e => e.lat && e.lon);
  const seen = new Set();
  const unique = withCoords.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  unique.sort((a, b) => b.timestamp - a.timestamp);
  const sc = zoomScale(map);
  unique.forEach(ev => {
    const { col, op } = incidentAgeColor(ev.timestamp);
    let m;
    if (ev.type === 'incident' || ev.type === 'vessel_attack' || ev.type === 'infrastructure_damage') {
      m = new L.BurstMarker([ev.lat, ev.lon], {
        radius: 8, interactive: true, fillColor: col, fillOpacity: op, color: '#fff', weight: 1.5, opacity: op,
      });
    } else if (ev.type === 'military_sighting') {
      m = new L.TriangleMarker([ev.lat, ev.lon], {
        radius: 7, rotation: 0, interactive: true, fillColor: col, fillOpacity: op, color: '#fff', weight: 1.5, opacity: op,
      });
    } else {
      m = L.circleMarker([ev.lat, ev.lon], {
        radius: 4, interactive: true, fillColor: col, fillOpacity: op * 0.7, color: col, weight: 1, opacity: op * 0.8, interactive: true,
      });
    }
    m.bindPopup(() => incidentPopup(ev), { maxWidth: 280 });
    m.bindTooltip(ev.title.slice(0, 60) + (ev.title.length > 60 ? '...' : ''), { permanent: false, direction: 'top', offset: [0, -8], className: 'port-label', interactive: false });
    incidentLayer.addLayer(m);
    incidentMarkers.push({ m, type: ev.type });
  });
}

export function initIncidents(map) {
  const incidentLayer = L.layerGroup().addTo(map);
  const incidentMarkers = [];

  function loadIncidents() {
    Promise.all([
      fetch('data/liveuamap-events.json').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/iranwarlive-events.json').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/reddit-events.json').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/news-events.json').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([lua, irw, rdt, nws]) => {
      const all = [];
      if (lua) (lua.events || lua).forEach(e => all.push(e));
      if (irw) (irw.events || irw).forEach(e => all.push(e));
      if (rdt) (rdt.events || rdt).forEach(e => all.push(e));
      if (nws) (nws.events || nws).forEach(e => all.push(e));
      renderIncidents(all, incidentLayer, incidentMarkers, map);
    });
  }

  loadIncidents();
  setInterval(loadIncidents, 120000);

  return { incidentLayer, incidentMarkers };
}
