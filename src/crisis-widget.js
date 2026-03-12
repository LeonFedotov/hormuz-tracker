function crisisColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#22c55e';
  return '#6b7280';
}

// Inverted: low score = bad (0 = fully blocked, 100 = normal)
function healthLabel(score) {
  if (score >= 80) return 'Normal';
  if (score >= 60) return 'Disrupted';
  if (score >= 40) return 'Degraded';
  if (score >= 20) return 'Severe';
  return 'Critical';
}

function renderCrisis(d) {
  const col = crisisColor(d.overall.score);
  const numEl = document.getElementById('crisisNum');
  const lblEl = document.getElementById('crisisLabel');
  const bdEl = document.getElementById('crisisBreakdown');
  const wEl = document.getElementById('crisisWidget');

  numEl.textContent = d.overall.score;
  numEl.style.color = col;
  lblEl.textContent = d.overall.label;
  lblEl.style.color = col;
  wEl.style.borderColor = col + '44';
  wEl.title = d.overall.description || '';

  const subs = [
    {
      lbl: 'Strait Transit',
      val: d.transit.score,
      detail: `${d.transit.moving} of ${d.transit.baseline} baseline moving`,
      meaning: healthLabel(d.transit.score)
    },
    {
      lbl: 'In/Out Balance',
      val: d.flow.score,
      detail: `${d.flow.inbound} in · ${d.flow.outbound} out`,
      meaning: healthLabel(d.flow.score)
    },
    {
      lbl: 'Oil Tankers',
      val: d.tankers.score,
      detail: `${d.tankers.moving} of ${d.tankers.baseline} baseline`,
      meaning: healthLabel(d.tankers.score)
    },
    {
      lbl: 'Stranded',
      val: d.stranded.score,
      detail: `${d.stranded.count} vessels stuck`,
      meaning: d.stranded.count > 100 ? 'Critical' : d.stranded.count > 30 ? 'Severe' : 'Moderate'
    },
  ];

  bdEl.innerHTML = subs.map(s => {
    const c = crisisColor(s.val);
    return `<div class="cb">
      <div class="cb-val" style="color:${c}">${s.val}<span style="font-size:9px;opacity:0.6">/100</span></div>
      <div class="cb-lbl">${s.lbl}</div>
      <div style="font-size:8px;color:${c};font-weight:600">${s.meaning}</div>
      <div style="font-size:7px;color:var(--fg-dim);margin-top:1px">${s.detail}</div>
    </div>`;
  }).join('');
}

export function initCrisisWidget() {
  fetch('data/crisis-score.json').then(r => r.ok ? r.json() : null).then(d => { if (d) renderCrisis(d); }).catch(() => {});
  setInterval(() => {
    fetch('data/crisis-score.json').then(r => r.ok ? r.json() : null).then(d => { if (d) renderCrisis(d); }).catch(() => {});
  }, 60000);
}
