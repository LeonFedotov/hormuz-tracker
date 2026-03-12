import L from 'leaflet';
import { TILES, getCurTheme } from './theme.js';

// ====== DIRECTIONAL TRIANGLE MARKER (canvas-rendered) ======
L.TriangleMarker = L.CircleMarker.extend({
  options: { rotation: 0, interactive: true },
  _updatePath: function() { this._renderer._updateTriangle(this); },
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= (this._radius * 1.5) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updateTriangle: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 2);
    const rot = (layer.options.rotation || 0) * Math.PI / 180;
    const ctx = this._ctx;
    const pts = [[0, -r * 1.4], [r * 0.85, r * 0.7], [-r * 0.85, r * 0.7]];
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = p.x + px * Math.cos(rot) - py * Math.sin(rot);
      const y = p.y + px * Math.sin(rot) + py * Math.cos(rot);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});

// Diamond marker for ports
L.DiamondMarker = L.CircleMarker.extend({
  options: { interactive: true },
  _updatePath: function() { this._renderer._updateDiamond(this); },
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= (this._radius * 1.0) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updateDiamond: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 3);
    const ctx = this._ctx;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r * 1.3); ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x, p.y + r * 1.3); ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});

// Square marker for refineries
L.SquareMarker = L.CircleMarker.extend({
  options: { interactive: true },
  _updatePath: function() { this._renderer._updateSquare(this); },
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= (this._radius * 1.0) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updateSquare: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 3);
    const ctx = this._ctx;
    ctx.beginPath();
    ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
    this._fillStroke(ctx, layer);
  }
});

// Hexagon marker for gas terminals
L.HexMarker = L.CircleMarker.extend({
  options: { interactive: true },
  _updatePath: function() { this._renderer._updateHex(this); },
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= (this._radius * 1.0) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updateHex: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 3);
    const ctx = this._ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      const x = p.x + r * Math.cos(a), y = p.y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});

// Pill/bar marker for pipeline terminals
L.PillMarker = L.CircleMarker.extend({
  options: { interactive: true },
  _updatePath: function() { this._renderer._updatePill(this); },
  _containsPoint: function(p) {
    return Math.abs(p.x - this._point.x) <= (this._radius * 1.0) && Math.abs(p.y - this._point.y) <= (this._radius * 0.8) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updatePill: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 3);
    const ctx = this._ctx, w = r * 2, h = r * 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y - h);
    ctx.lineTo(p.x + w, p.y - h);
    ctx.arcTo(p.x + w + h, p.y - h, p.x + w + h, p.y + h, h);
    ctx.lineTo(p.x - w, p.y + h);
    ctx.arcTo(p.x - w - h, p.y + h, p.x - w - h, p.y - h, h);
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});

// Burst/explosion marker for incidents (4-pointed cross burst, NOT a star of david)
L.BurstMarker = L.CircleMarker.extend({
  options: { interactive: true },
  _updatePath: function() { this._renderer._updateBurst(this); },
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= (this._radius * 1.0) + (this._clickTolerance ? this._clickTolerance() : 0);
  }
});
L.Canvas.include({
  _updateBurst: function(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, r = Math.max(Math.round(layer._radius), 3);
    const ctx = this._ctx, w = r * 0.35;
    // 4-armed cross/plus burst
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);        // top
    ctx.lineTo(p.x + w, p.y - w);
    ctx.lineTo(p.x + r, p.y);        // right
    ctx.lineTo(p.x + w, p.y + w);
    ctx.lineTo(p.x, p.y + r);        // bottom
    ctx.lineTo(p.x - w, p.y + w);
    ctx.lineTo(p.x - r, p.y);        // left
    ctx.lineTo(p.x - w, p.y - w);
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});

// ====== MAP INIT ======
export function initMap() {
  const map = L.map('map', { center: [25.0, 50.0], zoom: 5, zoomControl: false, preferCanvas: true, closePopupOnClick: false });
  map.on('popupopen', function(e) {
    e.popup.options.autoPan = false;
  });
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Single canvas — all interactive items share it

  const theme = getCurTheme();
  const tileLayer = L.tileLayer(TILES[theme], { attribution: 'OSM/CARTO', maxZoom: 18 }).addTo(map);

  return { map, tileLayer };
}

// Scale icons with the map — linear, gentle growth
// zoom 4 = 0.5x, zoom 6 = 1x, zoom 8 = 1.5x, zoom 10 = 2x, zoom 12 = 2.5x
export function zoomScale(map) {
  return 0.5 + (map.getZoom() - 4) * 0.25;
}
