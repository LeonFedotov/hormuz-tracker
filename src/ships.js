import { FE, FN, TN, FOC, fmt } from './utils.js';

// Categories
export const CATS = {
  INBOUND_IR:  { c: '#3b82f6', l: 'Inbound Iran',       d: 'Moving toward Iranian ports' },
  OUTBOUND_IR: { c: '#f59e0b', l: 'Outbound from Iran',  d: 'Leaving Iranian waters' },
  TRANSIT_W:   { c: '#10b981', l: 'Transit westbound',    d: 'Heading into Gulf (UAE/Qatar/Kuwait/Saudi)' },
  TRANSIT_E:   { c: '#06b6d4', l: 'Transit eastbound',    d: 'Heading out to Arabian Sea/Indian Ocean' },
  STRANDED:    { c: '#ef4444', l: 'Stranded',             d: 'Has destination but stationary' },
  IDLE:        { c: '#818cf8', l: 'Idle/Anchored',        d: 'Stationary, local or no destination' },
  SUPPORT:     { c: '#6b7280', l: 'Port support',         d: 'Tugs, pilots, service craft' },
  DARK:        { c: '#7f1d1d', l: 'SAT-AIS only',         d: 'No terrestrial AIS — satellite track only' },
};

// Bandar Abbas reference point
const BA_LAT = 27.18, BA_LON = 56.28;

export function destRegion(d) {
  if (!d) return 'UNK';
  const u = d.toUpperCase();
  if (/BND|BANDAR|B\.ABBAS|B ABBAS|RAJAEE|IRBND|IR BND|LARAK|KHORAMSHAHR|BUSHEHR|ASSALUYEH|IMAM KHOM|CHABAHAR|IRAN|MAHSHAHR/.test(u)) return 'IRAN';
  if (/DUBAI|DUBAY|J\.ALI|JEBEL|HAMRYH|HAMRIYAH|FUJAIRAH|FUJEIRAH|KHOR FAKKAN|SHARJAH|ABU DHABI|RUWAIS|AE |MUSSAFAH/.test(u)) return 'UAE';
  if (/SOHAR|MUSCAT|SALALAH|DUQM|OMAN/.test(u)) return 'OMAN';
  if (/DAMMAM|RAS TANURA|JUBAIL|YANBU|JEDDAH|SAUDI|JIZAN/.test(u)) return 'SAUDI';
  if (/BAHRAIN|SITRA|MINA SALMAN/.test(u)) return 'BAHRAIN';
  if (/QATAR|DOHA|RAS LAFFAN|MESAIEED/.test(u)) return 'QATAR';
  if (/KUWAIT|SHUWAIKH|SHUAIBA|MINA AL/.test(u)) return 'KUWAIT';
  if (/KANDLA|MUMBAI|MUNDRA|NHAVA|INDIA|CHENNAI|COCHIN|VIZAG|PIPAVAV|HAZIRA/.test(u)) return 'INDIA';
  if (/PAKISTAN|KARACHI|BIN QASIM/.test(u)) return 'PAKISTAN';
  if (/CHINA|SHANGHAI|NINGBO|QINGDAO|TIANJIN/.test(u)) return 'CHINA';
  if (/SINGAPORE/.test(u)) return 'SINGAPORE';
  if (u === 'FOR ORDERS' || u === 'CLASS B') return 'WAITING';
  return 'OTHER';
}

function classifyShip(lat, lon, spd, crs, dr, dest, isTug, len, sat) {
  if (sat) return 'DARK';
  if (isTug && len < 70 && (dr === 'IRAN' || dr === 'UNK' || dr === 'UAE' || !dest)) return 'SUPPORT';

  const moving = spd > 0.5;
  if (moving && crs !== null) {
    const nearBA = lat > 26.8 && lon > 55.5 && lon < 56.8;
    const nearFuj = lat > 24.8 && lat < 25.5 && lon > 56 && lon < 57;
    const headingN = crs >= 300 || crs <= 60;
    const headingSE = crs >= 80 && crs <= 200;
    const headingW = crs >= 240 && crs <= 320;
    const headingE = crs >= 60 && crs <= 150;

    if (nearBA && headingN && (dr === 'IRAN' || dr === 'UNK')) return 'INBOUND_IR';
    if (nearBA && headingSE) return 'OUTBOUND_IR';
    if (nearFuj && (dr === 'UAE' || dr === 'UNK')) return 'TRANSIT_W';
    if (dr === 'UAE' || dr === 'BAHRAIN' || dr === 'QATAR' || dr === 'KUWAIT' || dr === 'SAUDI') return 'TRANSIT_W';
    if (dr === 'OMAN' || dr === 'INDIA' || dr === 'PAKISTAN' || dr === 'CHINA' || dr === 'SINGAPORE') return 'TRANSIT_E';
    if (headingW) return 'TRANSIT_W';
    if (headingE && lat < 26.5) return 'TRANSIT_E';
    if (dr === 'IRAN') return 'INBOUND_IR';
    if (headingSE && lat < 27) return 'TRANSIT_E';
    return 'TRANSIT_W'; // default moving
  }

  if (!moving && (dr === 'UAE' || dr === 'OMAN' || dr === 'INDIA' || dr === 'PAKISTAN' || dr === 'BAHRAIN' || dr === 'QATAR' || dr === 'KUWAIT' || dr === 'SAUDI' || dr === 'CHINA' || dr === 'SINGAPORE' || dr === 'WAITING' || dr === 'OTHER') && dest) {
    return 'STRANDED';
  }
  if (!moving && dr === 'IRAN') return 'IDLE';
  if (moving && dr === 'IRAN') return 'INBOUND_IR';

  return 'IDLE';
}

// Parse ship-positions.json objects into ship objects
export function parseShips(D) {
  return D.map(r => {
    const sat = r.source === 'sat_ais';
    const spd = Number(r.speed_kn) || 0;
    const crs = r.course != null ? Number(r.course) : null;
    const hdg = r.heading != null ? Number(r.heading) : null;
    const el = r.elapsed_sec != null ? Number(r.elapsed_sec) : (r.timestamp ? Math.round((Date.now() - new Date(r.timestamp).getTime()) / 1000) : 0);
    const len = Number(r.length) || 0;
    const dwt = Number(r.dwt) || 0;
    const dest = (r.destination || '').trim();
    const dr = destRegion(dest);
    const flag = (r.flag || '').trim();
    const shipType = String(r.ship_type_code || r.ship_type || 0);
    const shipTypeName = r.ship_type || '';
    const isTug = shipType === '3' || shipTypeName === 'tug';
    const lat = Number(r.lat) || 0, lon = Number(r.lon) || 0;

    const cat = classifyShip(lat, lon, spd, crs, dr, dest, isTug, len, sat);

    // Map string type names to codes for compatibility
    const typeNameToCode = {cargo:'7',tanker:'8',tug:'3',passenger:'6',fishing:'2',hsc:'4',military:'5'};
    const typeCode = typeNameToCode[shipTypeName] || shipType;

    return {
      name: r.name || '', lat, lon, spd, crs, hdg, el, dest, dr, flag, len,
      w: Number(r.width) || 0, dwt, type: typeCode,
      tn: shipTypeName || TN[typeCode] || '?', sn: '', sat, cat,
      id: r.mmsi || '', isFoc: FOC.has(flag), isIR: flag === 'IR',
    };
  });
}

export function shipBaseRadius(s) {
  if (s.sat) return 1.5;
  if (s.dwt > 50000) return 3.5;
  if (s.dwt > 10000) return 2.5;
  if (s.len > 100) return 2.5;
  return 2;
}

export function shipTypeSVG(type, curTheme) {
  const t = String(type);
  const dark = curTheme === 'dark';
  const hull = dark ? '#ccc' : '#333';
  const detail = dark ? '#999' : '#555';
  const accent = dark ? '#fff' : '#000';
  const win = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
  if (t === '8') return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M3 18 Q5 12 10 12 L48 12 Q52 12 53 15 L53 19 Q28 22 3 19Z" fill="${hull}" opacity="0.85"/><rect x="44" y="7" width="6" height="5" rx="1" fill="${hull}"/><circle cx="20" cy="12" r="1.5" fill="${detail}"/><circle cx="26" cy="12" r="1.5" fill="${detail}"/><circle cx="32" cy="12" r="1.5" fill="${detail}"/><line x1="20" y1="10" x2="32" y2="10" stroke="${detail}" stroke-width="0.8"/></svg>`;
  if (t === '7') return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M4 19 Q6 14 10 14 L48 14 Q52 14 52 17 L52 20 L4 20Z" fill="${hull}" opacity="0.85"/><rect x="10" y="9" width="5" height="5" rx="0.5" fill="${hull}" opacity="0.8"/><rect x="16" y="9" width="5" height="5" rx="0.5" fill="${detail}" opacity="0.8"/><rect x="22" y="9" width="5" height="5" rx="0.5" fill="${hull}" opacity="0.8"/><rect x="12" y="4" width="5" height="5" rx="0.5" fill="${detail}" opacity="0.6"/><rect x="18" y="4" width="5" height="5" rx="0.5" fill="${hull}" opacity="0.6"/><rect x="43" y="7" width="6" height="7" rx="1" fill="${hull}"/><line x1="36" y1="3" x2="36" y2="14" stroke="${detail}" stroke-width="1"/><line x1="33" y1="3" x2="39" y2="3" stroke="${detail}" stroke-width="0.8"/></svg>`;
  if (t === '3') return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M8 18 Q10 13 15 13 L38 13 Q44 13 46 16 L46 19 L8 19Z" fill="${hull}" opacity="0.85"/><rect x="30" y="7" width="8" height="6" rx="1" fill="${hull}"/><rect x="32" y="4" width="4" height="3" rx="0.5" fill="${detail}" opacity="0.7"/><circle cx="12" cy="13" r="1.5" fill="${detail}"/><line x1="4" y1="16" x2="12" y2="14" stroke="${detail}" stroke-width="1.2" stroke-dasharray="2,2"/></svg>`;
  if (t === '6') return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M3 20 L6 14 L50 14 L53 20 L53 21 L3 21Z" fill="${hull}" opacity="0.85"/><rect x="8" y="9" width="38" height="5" rx="1" fill="${hull}" opacity="0.8"/><rect x="12" y="5" width="30" height="4" rx="1" fill="${detail}" opacity="0.6"/><rect x="42" y="2" width="4" height="3" rx="0.5" fill="${detail}"/><line x1="14" y1="12" x2="16" y2="12" stroke="${win}" stroke-width="0.8"/><line x1="19" y1="12" x2="21" y2="12" stroke="${win}" stroke-width="0.8"/><line x1="24" y1="12" x2="26" y2="12" stroke="${win}" stroke-width="0.8"/><line x1="29" y1="12" x2="31" y2="12" stroke="${win}" stroke-width="0.8"/><line x1="34" y1="12" x2="36" y2="12" stroke="${win}" stroke-width="0.8"/></svg>`;
  if (t === '2') return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M8 18 Q10 13 16 13 L40 13 L44 17 L44 19 L8 19Z" fill="${hull}" opacity="0.85"/><line x1="20" y1="4" x2="20" y2="13" stroke="${hull}" stroke-width="1.5"/><line x1="20" y1="4" x2="36" y2="8" stroke="${detail}" stroke-width="0.8"/><line x1="20" y1="4" x2="10" y2="9" stroke="${detail}" stroke-width="0.8"/><line x1="36" y1="8" x2="38" y2="13" stroke="${detail}" stroke-width="0.6" stroke-dasharray="1,2"/></svg>`;
  return `<svg width="100%" height="40" viewBox="0 0 56 24" preserveAspectRatio="xMidYMid meet"><path d="M4 18 Q6 12 12 12 L44 12 Q50 12 50 16 L50 19 L4 19Z" fill="none" stroke="${detail}" stroke-width="1.5"/><rect x="38" y="7" width="6" height="5" rx="1" fill="none" stroke="${detail}" stroke-width="1"/></svg>`;
}

export function shipPopup(s, curTheme) {
  const ci = CATS[s.cat];
  let h = '<div style="margin:-2px -4px 6px;padding:4px;background:var(--bg-bar);border-radius:4px">' + shipTypeSVG(s.type, curTheme) + '</div>';
  h += `<div class="pn">${s.name}</div>`;
  h += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><div class="pc" style="background:${ci.c}22;color:${ci.c};border:1px solid ${ci.c}44">${ci.l}</div><span style="font-size:10px;color:var(--fg-dim)">${s.tn}</span></div>`;
  if (s.flag) h += `<div>${FE[s.flag] || ''} ${FN[s.flag] || s.flag}${s.isFoc ? ' <span style="color:#f88;font-size:9px">(FOC)</span>' : ''}</div>`;
  h += `<div class="pr"><span class="pl">Speed</span><span class="pv">${s.spd.toFixed(1)} kn</span></div>`;
  if (s.crs !== null) h += `<div class="pr"><span class="pl">Course</span><span class="pv">${s.crs}&deg;</span></div>`;
  if (s.len) h += `<div class="pr"><span class="pl">Size</span><span class="pv">${s.len}m&times;${s.w}m</span></div>`;
  if (s.dwt) h += `<div class="pr"><span class="pl">DWT</span><span class="pv">${s.dwt.toLocaleString()}t</span></div>`;
  if (s.dest) h += `<div class="pr"><span class="pl">Dest</span><span class="pv">${s.dest} <span style="color:${ci.c};font-size:9px">${s.dr}</span></span></div>`;
  h += `<div class="pr"><span class="pl">Updated</span><span class="pv" style="color:${s.el > 600 ? '#f66' : '#4a8'}">${fmt(s.el)} ago</span></div>`;
  if (s.cat === 'STRANDED') h += `<div style="margin-top:3px;padding:3px 5px;background:#ef444420;border-radius:2px;font-size:9px;color:#f88">Stationary with destination set — possible disruption</div>`;
  return h;
}
