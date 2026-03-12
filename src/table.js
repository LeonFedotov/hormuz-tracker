import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { CATS, shipBaseRadius } from './ships.js';
import { FE, FN, fmt } from './utils.js';

const catOrd = ['OUTBOUND_IR', 'INBOUND_IR', 'TRANSIT_W', 'TRANSIT_E', 'STRANDED', 'IDLE', 'SUPPORT', 'DARK'];

export function initTable(ships, map, markerById) {
  const uniqueFlags = [...new Set(ships.filter(s => s.flag).map(s => s.flag))].sort();
  const uniqueTypes = [...new Set(ships.map(s => s.tn))].sort();
  const uniqueDR = [...new Set(ships.map(s => s.dr))].sort();

  const table = new Tabulator('#ship-table', {
    data: ships.map(s => ({
      id: s.id, cat: s.cat, catLabel: CATS[s.cat].l, catColor: CATS[s.cat].c,
      name: s.name, flag: s.flag, flagEmoji: (FE[s.flag] || ''),
      flagName: FN[s.flag] || s.flag || '?', tn: s.tn, spd: s.spd, crs: s.crs,
      dwt: s.dwt, dest: s.dest, dr: s.dr, el: s.el, sat: s.sat,
      len: s.len, w: s.w, isFoc: s.isFoc, isIR: s.isIR,
      lat: s.lat, lon: s.lon,
    })),
    layout: 'fitColumns',
    height: '100%',
    renderVertical: 'virtual',
    renderHorizontal: 'virtual',
    placeholder: 'No matching vessels',
    initialSort: [{ column: 'dwt', dir: 'desc' }],
    groupBy: false,
    groupStartOpen: true,
    groupHeader: function(value, count) {
      const ci = CATS[value];
      if (ci) return `<span style="color:${ci.c}">${ci.l}</span> <span>(${count} vessels)</span>`;
      return value + ' <span>(' + count + ')</span>';
    },
    rowFormatter: function(row) {
      const d = row.getData();
      if (d.sat) row.getElement().classList.add('dim-row');
      row.getElement().style.borderLeft = '3px solid ' + d.catColor;
    },
    columns: [
      {
        title: 'Status', field: 'cat', width: 120, headerFilter: 'select',
        headerFilterParams: { values: Object.fromEntries([['', 'All'], ...catOrd.map(k => [k, CATS[k].l])]) },
        formatter: function(cell) {
          const d = cell.getData();
          return `<span class="tag" style="background:${d.catColor}22;color:${d.catColor}">${d.catLabel}</span>`;
        },
        sorter: function(a, b) { return catOrd.indexOf(a) - catOrd.indexOf(b); },
      },
      {
        title: 'Vessel', field: 'name', minWidth: 130, headerFilter: 'input',
        formatter: function(cell) { return '<strong>' + cell.getValue() + '</strong>'; },
      },
      {
        title: 'Flag', field: 'flag', width: 75, headerFilter: 'select',
        headerFilterParams: { values: Object.fromEntries([['', 'All'], ...uniqueFlags.map(f => [f, (FE[f] || '') + ' ' + f])]) },
        formatter: function(cell) {
          const d = cell.getData();
          return d.flag ? (d.flagEmoji + ' ' + d.flag + (d.isFoc ? ' <span style="color:#f66;font-size:8px">FOC</span>' : '')) : '-';
        },
      },
      {
        title: 'Type', field: 'tn', width: 85, headerFilter: 'select',
        headerFilterParams: { values: Object.fromEntries([['', 'All'], ...uniqueTypes.map(t => [t, t])]) },
      },
      {
        title: 'Spd', field: 'spd', width: 55, hozAlign: 'right',
        formatter: function(cell) { const v = cell.getValue(); return v > 0 ? v.toFixed(1) : '<span style="color:var(--fg-dim)">0</span>'; },
        headerFilter: 'number', headerFilterPlaceholder: 'min', headerFilterFunc: '>=',
      },
      {
        title: 'Crs', field: 'crs', width: 50, hozAlign: 'right',
        formatter: function(cell) { const v = cell.getValue(); return v !== null ? v + '°' : '-'; },
      },
      {
        title: 'DWT', field: 'dwt', width: 85, hozAlign: 'right',
        formatter: function(cell) { const v = cell.getValue(); return v ? v.toLocaleString() : '-'; },
        headerFilter: 'number', headerFilterPlaceholder: 'min', headerFilterFunc: '>=',
      },
      {
        title: 'Length', field: 'len', width: 55, hozAlign: 'right',
        formatter: function(cell) { const v = cell.getValue(); return v ? v + 'm' : '-'; },
      },
      {
        title: 'Dest', field: 'dest', minWidth: 110, headerFilter: 'input',
        formatter: function(cell) {
          const d = cell.getData();
          const dr = d.dr;
          const col = dr === 'IRAN' ? '#818cf8' : dr === 'UAE' || dr === 'OMAN' || dr === 'SAUDI' ? '#10b981' : 'var(--fg-dim)';
          return `<span style="color:${col}">${cell.getValue() || '-'}</span>`;
        },
      },
      {
        title: 'Region', field: 'dr', width: 75, headerFilter: 'select',
        headerFilterParams: { values: Object.fromEntries([['', 'All'], ...uniqueDR.map(r => [r, r])]) },
      },
      {
        title: 'Age', field: 'el', width: 60, hozAlign: 'right',
        formatter: function(cell) { const v = cell.getValue(); return `<span style="color:${v > 600 ? '#f66' : '#4a8'}">${fmt(v)}</span>`; },
        headerFilter: 'number', headerFilterPlaceholder: 'max', headerFilterFunc: '<=',
      },
    ],
  });

  // Click row → fly to ship on map
  table.on('rowClick', function(e, row) {
    const d = row.getData();
    const x = markerById[d.id];
    if (x) { map.flyTo([x.s.lat, x.s.lon], 12); x.m.openPopup(); }
  });

  return table;
}

export function initTableControls(table, map) {
  let vpFilterEnabled = true;

  function syncTableToViewport() {
    if (!vpFilterEnabled) return;
    const b = map.getBounds();
    const n = b.getNorth(), s = b.getSouth(), e = b.getEast(), w = b.getWest();
    table.setFilter(function(data) {
      return data.lat >= s && data.lat <= n && data.lon >= w && data.lon <= e;
    });
    const ct = table.getDataCount('active');
    const el = document.getElementById('vpCount');
    if (el) el.textContent = ct + ' in view';
  }

  // Debounce
  let vpTimer;
  map.on('moveend', function() { clearTimeout(vpTimer); vpTimer = setTimeout(syncTableToViewport, 150); });
  setTimeout(syncTableToViewport, 300);

  // Toggle button
  const vpToggle = document.getElementById('vpToggle');
  if (vpToggle) {
    vpToggle.addEventListener('click', () => {
      vpFilterEnabled = !vpFilterEnabled;
      if (vpFilterEnabled) {
        vpToggle.classList.add('active'); vpToggle.textContent = 'Viewport filter: ON';
        syncTableToViewport();
      } else {
        vpToggle.classList.remove('active'); vpToggle.textContent = 'Viewport filter: OFF';
        table.clearFilter();
      }
    });
  }

  // Group-by buttons
  document.querySelectorAll('.gb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.g;
      if (field) { table.setGroupBy(field); }
      else { table.setGroupBy(false); }
      document.querySelectorAll('.gb-btn').forEach(b => b.classList.toggle('active', b.dataset.g === field));
    });
  });
}
