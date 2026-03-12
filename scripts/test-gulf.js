import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 30;
// Wider: entire Strait of Hormuz + approaches 
const BBOX = [[24.0, 54.0], [28.0, 58.0]];

const stats = { total: 0, byType: {}, mmsis: new Set(), first: null, last: null };
const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

const timeout = setTimeout(() => {
  const dur = stats.first ? ((stats.last - stats.first) / 1000).toFixed(1) : 0;
  console.log(`\n=== WIDER HORMUZ BBOX RESULTS (30s) ===`);
  console.log(`BBox: ${JSON.stringify(BBOX)}`);
  console.log(`Total: ${stats.total} | Vessels: ${stats.mmsis.size} | Rate: ${dur > 0 ? (stats.total/dur).toFixed(2) : 0} msg/s`);
  console.log(`Types:`, JSON.stringify(stats.byType));
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  console.log(`Subscribing to wider Hormuz area: ${JSON.stringify(BBOX)}`);
  socket.send(JSON.stringify({ APIkey: API_KEY, BoundingBoxes: [BBOX] }));
});
socket.addEventListener("error", (e) => console.error("ERROR:", e.message));
socket.addEventListener("close", (e) => { console.log(`Closed: ${e.code} ${e.reason}`); clearTimeout(timeout); process.exit(0); });
socket.addEventListener("message", (event) => {
  const now = Date.now();
  stats.total++;
  if (!stats.first) stats.first = now;
  stats.last = now;
  try {
    const msg = JSON.parse(event.data);
    stats.byType[msg.MessageType] = (stats.byType[msg.MessageType] || 0) + 1;
    if (msg.MetaData?.MMSI) stats.mmsis.add(msg.MetaData.MMSI);
  } catch {}
  if (stats.total <= 5) {
    try {
      const msg = JSON.parse(event.data);
      console.log(`  ${msg.MessageType} | ${msg.MetaData?.MMSI} | ${msg.MetaData?.ShipName?.trim()}`);
    } catch {}
  }
});
