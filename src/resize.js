export function initResize(map) {
  const mapWrap = document.getElementById('map-wrap');
  const panel = document.getElementById('panel');
  const hResize = document.getElementById('hResize');

  // Horizontal resize (map vs panel)
  let hDragging = false, startY, startMapH, startPanelH;
  hResize.addEventListener('mousedown', e => {
    hDragging = true; startY = e.clientY;
    startMapH = mapWrap.offsetHeight; startPanelH = panel.offsetHeight;
    document.body.classList.add('resizing'); hResize.classList.add('active');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!hDragging) return;
    const dy = e.clientY - startY;
    const totalH = startMapH + startPanelH;
    const newMapH = Math.max(120, Math.min(totalH - 80, startMapH + dy));
    const newPanelH = totalH - newMapH;
    mapWrap.style.flex = '0 0 ' + newMapH + 'px';
    panel.style.height = newPanelH + 'px';
    map.invalidateSize();
  });
  document.addEventListener('mouseup', () => {
    if (hDragging) { hDragging = false; document.body.classList.remove('resizing'); hResize.classList.remove('active'); map.invalidateSize(); }
  });

  // Vertical resize (columns)
  document.querySelectorAll('.v-resize').forEach(handle => {
    let dragging = false, startX, leftEl, rightEl, startLW, startRW;
    handle.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX;
      leftEl = handle.previousElementSibling; rightEl = handle.nextElementSibling;
      startLW = leftEl.offsetWidth; startRW = rightEl.offsetWidth;
      document.body.classList.add('resizing-col'); handle.classList.add('active');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const total = startLW + startRW;
      const newLW = Math.max(150, Math.min(total - 150, startLW + dx));
      const newRW = total - newLW;
      leftEl.style.width = newLW + 'px'; leftEl.style.flex = '0 0 ' + newLW + 'px';
      rightEl.style.width = newRW + 'px';
      if (rightEl.style.flex !== undefined) rightEl.style.flex = '0 0 ' + newRW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; document.body.classList.remove('resizing-col'); handle.classList.remove('active'); }
    });
  });
}
