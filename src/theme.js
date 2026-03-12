import L from 'leaflet';

export const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

export function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
}

let curTheme = getSystemTheme();
let tileLayerRef = null;
let mapRef = null;

export function getCurTheme() { return curTheme; }

export function initTheme(map, tileLayer) {
  mapRef = map;
  tileLayerRef = tileLayer;
  applyTheme(curTheme);
  window.matchMedia('(prefers-color-scheme:light)').addEventListener('change', e => applyTheme(e.matches ? 'light' : 'dark'));
}

export function applyTheme(t) {
  curTheme = t;
  document.documentElement.setAttribute('data-theme', t);
  if (tileLayerRef && mapRef) {
    mapRef.removeLayer(tileLayerRef);
    tileLayerRef = L.tileLayer(TILES[t], { attribution: 'OSM/CARTO', maxZoom: 18 }).addTo(mapRef);
  }
}
