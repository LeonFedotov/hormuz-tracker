import { CATS } from './ships.js';
import { FE, FN, FOC, fmt } from './utils.js';

export function renderDashboard(ships, cc, dwtBy, id) {
  const totalDWT = id.reduce((a, s) => a + s.dwt, 0);
  const totalMoving = ships.filter(s => s.spd > 0.5).length;
  const totalStopped = ships.length - totalMoving;

  // Iranian flag splits
  const irShips = id.filter(s => s.isIR);
  const irIn = irShips.filter(s => s.cat === 'INBOUND_IR').length;
  const irOut = irShips.filter(s => s.cat === 'OUTBOUND_IR').length;
  const irIdle = irShips.filter(s => s.cat === 'IDLE').length;
  const irStrand = irShips.filter(s => s.cat === 'STRANDED').length;
  const irTransW = irShips.filter(s => s.cat === 'TRANSIT_W').length;
  const irTransE = irShips.filter(s => s.cat === 'TRANSIT_E').length;

  const focShips = id.filter(s => s.isFoc);

  // Tanker vs Cargo
  const tankers = id.filter(s => s.type === '8');
  const cargo = id.filter(s => s.type === '7');
  const tankerMoving = tankers.filter(s => s.spd > 0.5).length;
  const cargoMoving = cargo.filter(s => s.spd > 0.5).length;

  // Flag counts
  const flCounts = {};
  id.forEach(s => { flCounts[s.flag || '?'] = (flCounts[s.flag || '?'] || 0) + 1; });

  const maxCat = Math.max(...Object.values(cc).map(a => a.length));

  document.getElementById('dash').innerHTML = `
<h2>Traffic Summary</h2>
<div class="big-stats">
  <div class="big-stat"><div class="lb">Total vessels</div><div class="val">${ships.length}</div><div class="s" style="color:#4a8">${id.length} identified</div></div>
  <div class="big-stat"><div class="lb">Moving</div><div class="val" style="color:#f0c060">${totalMoving}</div><div class="s" style="color:#888">${totalStopped} stopped</div></div>
  <div class="big-stat"><div class="lb">Total DWT</div><div class="val">${(totalDWT / 1e6).toFixed(1)}M</div><div class="s" style="color:#888">${totalDWT.toLocaleString()}t</div></div>
</div>

<h2>Flow Categories</h2>
${Object.entries(CATS).map(([k, v]) => `<div class="bar-row"><div class="bar-label">${v.l}</div><div class="bar-wrap"><div class="bar-fill" style="background:${v.c};width:${(cc[k].length / maxCat * 100)}%">${cc[k].length}</div></div></div>`).join('')}

<h2>Direction Balance</h2>
<div class="ratio-bar">
  <div class="ratio-seg" style="background:#3b82f6;width:${cc.INBOUND_IR.length / (cc.INBOUND_IR.length + cc.OUTBOUND_IR.length + cc.TRANSIT_W.length + cc.TRANSIT_E.length || 1) * 100}%">${cc.INBOUND_IR.length} in</div>
  <div class="ratio-seg" style="background:#f59e0b;width:${cc.OUTBOUND_IR.length / (cc.INBOUND_IR.length + cc.OUTBOUND_IR.length + cc.TRANSIT_W.length + cc.TRANSIT_E.length || 1) * 100}%">${cc.OUTBOUND_IR.length} out</div>
  <div class="ratio-seg" style="background:#10b981;width:${cc.TRANSIT_W.length / (cc.INBOUND_IR.length + cc.OUTBOUND_IR.length + cc.TRANSIT_W.length + cc.TRANSIT_E.length || 1) * 100}%">${cc.TRANSIT_W.length} W</div>
  <div class="ratio-seg" style="background:#06b6d4;width:${cc.TRANSIT_E.length / (cc.INBOUND_IR.length + cc.OUTBOUND_IR.length + cc.TRANSIT_W.length + cc.TRANSIT_E.length || 1) * 100}%">${cc.TRANSIT_E.length} E</div>
</div>
<div style="font-size:10px;color:#888;margin-bottom:6px">Inbound DWT: ${(dwtBy.INBOUND_IR / 1e6).toFixed(2)}M · Outbound: ${(dwtBy.OUTBOUND_IR / 1e6).toFixed(2)}M · Stranded: ${(dwtBy.STRANDED / 1e6).toFixed(2)}M</div>

<h2>Iran-Flagged (${irShips.length})</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:10px">
  <div><span style="color:${CATS.INBOUND_IR.c}">Inbound</span> <strong>${irIn}</strong></div>
  <div><span style="color:${CATS.OUTBOUND_IR.c}">Outbound</span> <strong>${irOut}</strong></div>
  <div><span style="color:${CATS.TRANSIT_W.c}">Transit W</span> <strong>${irTransW}</strong></div>
  <div><span style="color:${CATS.TRANSIT_E.c}">Transit E</span> <strong>${irTransE}</strong></div>
  <div><span style="color:${CATS.IDLE.c}">Idle</span> <strong>${irIdle}</strong></div>
  <div><span style="color:${CATS.STRANDED.c}">Stranded</span> <strong>${irStrand}</strong></div>
</div>

<h2 style="margin-top:8px">FOC Flags (${focShips.length})</h2>
<div style="font-size:10px;color:#f88">Ships using flag-of-convenience registries<br>
Comoros, Togo, Panama, Liberia, Marshall Is., Palau, etc.</div>
<div style="font-size:10px;margin-top:4px">${focShips.filter(s => s.cat === 'STRANDED').length} stranded, ${focShips.filter(s => s.spd > 0.5).length} moving</div>

<h2 style="margin-top:8px">Tankers vs Cargo</h2>
<div style="font-size:10px">
  Tankers: ${tankers.length} (${tankerMoving} moving, ${tankers.length - tankerMoving} stopped)<br>
  Cargo: ${cargo.length} (${cargoMoving} moving, ${cargo.length - cargoMoving} stopped)
</div>

<h2 style="margin-top:8px">Top Flags</h2>
${Object.entries(flCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, c]) =>
    `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:10px"><span>${FE[f] || ''} ${FN[f] || f || '?'}${FOC.has(f) ? ' <span style="color:#f66;font-size:8px">FOC</span>' : ''}</span><span style="color:#fff;font-weight:700">${c}</span></div>`
  ).join('')}

<h2 style="margin-top:8px">Table Controls</h2>
<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;align-items:center">
  <button class="theme-btn active" id="vpToggle" style="font-size:9px">Viewport filter: ON</button>
  <span id="vpCount" style="font-size:10px;color:var(--fg-accent);font-weight:600"></span>
</div>
<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
  <span style="font-size:9px;color:var(--fg-dim);margin-right:2px">Group:</span>
  <button class="theme-btn gb-btn active" data-g="" style="font-size:9px">None</button>
  <button class="theme-btn gb-btn" data-g="cat" style="font-size:9px">Status</button>
  <button class="theme-btn gb-btn" data-g="flag" style="font-size:9px">Flag</button>
  <button class="theme-btn gb-btn" data-g="tn" style="font-size:9px">Type</button>
  <button class="theme-btn gb-btn" data-g="dr" style="font-size:9px">Region</button>
</div>

<h2>Legend (click to toggle)</h2>
<div class="legend" id="leg">${Object.entries(CATS).map(([k, v]) => `<div class="legend-item" data-c="${k}"><div class="legend-dot" style="background:${v.c}"></div><span>${v.l} (${cc[k].length})</span></div>`).join('')}</div>
<h2>Overlay Layers (click to toggle)</h2>
<div class="legend" id="overlayLeg">
  <div class="legend-item" data-layer="infra"><div class="legend-dot" style="background:#6b7280;border:2px solid #6b7280;box-sizing:border-box"></div><span>Infrastructure</span></div>
  <div class="legend-item" data-layer="incidents"><div class="legend-dot" style="background:#ef4444"></div><span>Incidents</span></div>
  <div class="legend-item" data-layer="ports"><div class="legend-dot" style="background:#818cf8;border-radius:1px;transform:rotate(45deg)"></div><span>Ports</span></div>
</div>
`;
}

export function initDashboardControls(map, overlayLayers) {
  // Legend toggle (ship categories)
  document.querySelectorAll('#leg .legend-item').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('dim');
    });
  });
  // Overlay layer toggles
  document.querySelectorAll('#overlayLeg .legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const lg = overlayLayers[el.dataset.layer];
      if (!lg) return;
      if (map.hasLayer(lg)) { map.removeLayer(lg); el.classList.add('dim'); }
      else { map.addLayer(lg); el.classList.remove('dim'); }
    });
  });
}
