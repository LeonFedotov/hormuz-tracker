import { CATS } from './ships.js';
import { FE, fmt } from './utils.js';

/**
 * Data-driven Situation Assessment panel.
 * Pulls from crisis-score.json, supply-chain-impact.json, all-events.json
 * plus live ship data. Auto-refreshes every 60s.
 */

function sevColor(label) {
  const l = (label || '').toUpperCase();
  if (l === 'CRITICAL') return '#ef4444';
  if (l === 'SEVERE' || l === 'HIGH') return '#f59e0b';
  if (l === 'ELEVATED') return '#eab308';
  if (l === 'MODERATE' || l === 'NORMAL') return '#4ade80';
  return 'var(--fg-dim)';
}

function daysColor(d) {
  if (d <= 14) return '#ef4444';
  if (d <= 30) return '#f59e0b';
  if (d <= 60) return '#eab308';
  return '#4ade80';
}

function timeAgo(ts) {
  const ms = Date.now() - ts;
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
  return Math.floor(ms / 86400000) + 'd ago';
}

export function renderAnalysis(ships, cc, dwtBy, id) {
  const el = document.getElementById('ana');

  // Compute ship-data-driven stats
  const stranded = cc.STRANDED.filter(s => !s.sat);
  const irShips = id.filter(s => s.isIR);
  const irIn = irShips.filter(s => s.cat === 'INBOUND_IR').length;
  const irOut = irShips.filter(s => s.cat === 'OUTBOUND_IR').length;
  const focShips = id.filter(s => s.isFoc);
  const tankers = id.filter(s => s.type === '8');
  const tankerMoving = tankers.filter(s => s.spd > 0.5).length;

  // Fetch live data and render
  Promise.all([
    fetch('data/crisis-score.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/supply-chain-impact.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/all-events.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]).then(([score, supply, eventsData]) => {
    const events = eventsData?.events || eventsData || [];
    const incidents = events.filter(e => e.type === 'incident' || e.type === 'vessel_attack' || e.type === 'infrastructure_damage');
    const recentIncidents = incidents
      .filter(e => e.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);

    const commodities = supply?.commodities || [];
    const critChains = supply?.critical_timelines || supply?.downstream_chains || commodities
      .filter(c => c.days_to_critical)
      .sort((a, b) => a.days_to_critical - b.days_to_critical);

    let h = `<h2>Situation Assessment</h2>`;

    // Overall crisis level
    if (score) {
      const col = sevColor(score.overall?.label);
      h += `<div class="ins alert" style="border-left-color:${col}">
        <div class="t" style="color:${col}">Crisis Level: ${score.overall?.label || '?'} (${score.overall?.score}/100)</div>
        <div class="tx">${score.overall?.description || score.summary || ''}</div>
      </div>`;
    }

    // Traffic flow from live ship data
    const inbound = cc.INBOUND_IR.length;
    const outbound = cc.OUTBOUND_IR.length;
    const ratio = outbound > 0 ? (inbound / outbound).toFixed(1) : '\u221e';
    const flowClass = outbound < 3 ? 'alert' : outbound < inbound * 0.5 ? 'alert' : 'info';
    h += `<div class="ins ${flowClass}">
      <div class="t">Traffic Flow: ${inbound} inbound, ${outbound} outbound</div>
      <div class="tx">Ratio: <strong>${ratio}:1</strong> (inbound:outbound). DWT: ${(dwtBy.INBOUND_IR / 1e3).toFixed(0)}k in vs ${(dwtBy.OUTBOUND_IR / 1e3).toFixed(0)}k out.
      ${cc.TRANSIT_W.length} westbound into Gulf, ${cc.TRANSIT_E.length} eastbound to Arabian Sea.
      ${outbound < 3 ? '<br><strong>Near-zero outbound — export lanes appear blocked.</strong>' : ''}</div>
    </div>`;

    // Stranded vessels
    if (stranded.length > 0) {
      h += `<div class="ins alert">
        <div class="t">${stranded.length} vessels stranded (${(dwtBy.STRANDED / 1e3).toFixed(0)}k DWT)</div>
        <div class="tx">${stranded.sort((a, b) => b.dwt - a.dwt).slice(0, 5).map(s =>
          `<strong>${s.name}</strong> ${FE[s.flag] || ''} \u2192 ${s.dest} (${(s.dwt / 1e3).toFixed(0)}k t)`
        ).join('<br>')}</div>
      </div>`;
    }

    // Supply chain urgency
    if (critChains.length > 0) {
      h += `<div class="ins alert" style="border-left-color:#ef4444">
        <div class="t" style="color:#ef4444">Supply Chain Countdown</div>
        <div class="tx">${critChains.slice(0, 5).map(c => {
          const d = c.days_to_critical || c.days;
          const name = c.name || c.chain;
          return `<div style="display:flex;justify-content:space-between;padding:2px 0">
            <span>${name}</span>
            <strong style="color:${daysColor(d)}">${d}d</strong>
          </div>`;
        }).join('')}</div>
      </div>`;
    }

    // Recent incidents
    if (recentIncidents.length > 0) {
      h += `<div class="ins" style="border-left-color:#f59e0b">
        <div class="t" style="color:#f59e0b">Recent Incidents (${incidents.length} total)</div>
        <div class="tx">${recentIncidents.map(e =>
          `<div style="margin-bottom:4px"><strong>${e.title || 'Unnamed'}</strong>
          <span style="color:var(--fg-dim);font-size:9px">${e.timestamp ? timeAgo(e.timestamp) : ''} · ${e.source || '?'}</span></div>`
        ).join('')}</div>
      </div>`;
    }

    // Tanker analysis
    h += `<div class="ins info">
      <div class="t">Tanker Traffic</div>
      <div class="tx">${tankers.length} tankers in zone. ${tankerMoving} moving, ${tankers.length - tankerMoving} stopped.
      Baseline: ~35 transits/day.${score?.tankers ? ` Current score: ${score.tankers.score}/100.` : ''}
      ${tankerMoving < 10 ? '<br><strong>Oil traffic critically low.</strong>' : ''}</div>
    </div>`;

    // Iran fleet
    h += `<div class="ins">
      <div class="t">Iran-flagged fleet (${irShips.length})</div>
      <div class="tx">${irIn} inbound, ${irOut} outbound, ${irShips.filter(s => s.cat === 'IDLE').length} idle, ${irShips.filter(s => s.cat === 'STRANDED').length} stranded.
      ${irOut === 0 ? 'Zero outbound — Iran export lanes fully blocked.' : ''}</div>
    </div>`;

    // FOC ships
    if (focShips.length > 0) {
      h += `<div class="ins">
        <div class="t">Flag-of-Convenience vessels (${focShips.length})</div>
        <div class="tx">${focShips.filter(s => s.cat === 'STRANDED').length} stranded, ${focShips.filter(s => s.spd > 0.5).length} moving.
        Often used to obscure beneficial ownership or evade sanctions.</div>
      </div>`;
    }

    // Dark ships
    h += `<div class="ins">
      <div class="t">SAT-AIS / Dark ships (${cc.DARK.length})</div>
      <div class="tx">Vessels only visible via satellite — no terrestrial AIS. Could indicate transponder manipulation, military ops, or sanctions evasion.</div>
    </div>`;

    // Data freshness
    const sources = {};
    events.forEach(e => { sources[e.source] = (sources[e.source] || 0) + 1; });
    h += `<div class="ins ok">
      <div class="t">Data Sources</div>
      <div class="tx">${Object.entries(sources).map(([s, c]) => `${s}: ${c}`).join(' · ')}
      <br>Ship data: ${ships.length.toLocaleString()} vessels (HAR snapshot)
      <br><span style="font-size:9px;color:var(--fg-dim)">Run <code>node server/collect.js</code> to refresh</span></div>
    </div>`;

    el.innerHTML = h;
  });

  // Set initial loading state
  el.innerHTML = '<h2>Situation Assessment</h2><div class="ins"><div class="t">Loading...</div></div>';
}

// Auto-refresh every 60s
let refreshTimer;
export function startAnalysisRefresh(ships, cc, dwtBy, id) {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => renderAnalysis(ships, cc, dwtBy, id), 60000);
}
