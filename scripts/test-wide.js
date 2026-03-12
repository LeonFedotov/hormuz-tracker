import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 15;
const BBOX = [[20.0, 48.0], [30.0, 60.0]];

const stats = { totalMessages: 0, byType: {}, uniqueMMSIs: new Set(), firstMessageAt: null, lastMessageAt: null };
const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

const timeout = setTimeout(() => {
  const duration = stats.firstMessageAt && stats.lastMessageAt ? ((stats.lastMessageAt - stats.firstMessageAt) / 1000).toFixed(1) : 0;
  const rate = duration > 0 ? (stats.totalMessages / duration).toFixed(2) : 0;
  console.log(`\n=== WIDER BBOX RESULTS (15s) ===`);
  console.log(`Total: ${stats.totalMessages} | Vessels: ${stats.uniqueMMSIs.size} | Rate: ${rate} msg/s`);
  console.log(`Types:`, JSON.stringify(stats.byType));
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  console.log("Connected. Subscribing to wider bbox:", JSON.stringify(BBOX));
  socket.send(JSON.stringify({ APIkey: API_KEY, BoundingBoxes: [BBOX] }));
});
socket.addEventListener("error", (e) => console.error("ERROR:", e.message));
socket.addEventListener("close", (e) => { console.log(`Closed: ${e.code} ${e.reason}`); clearTimeout(timeout); process.exit(0); });
socket.addEventListener("message", (event) => {
  const now = Date.now();
  stats.totalMessages++;
  if (!stats.firstMessageAt) stats.firstMessageAt = now;
  stats.lastMessageAt = now;
  try {
    const msg = JSON.parse(event.data);
    const type = msg.MessageType || "?";
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    if (msg.MetaData?.MMSI) stats.uniqueMMSIs.add(msg.MetaData.MMSI);
    if (stats.totalMessages % 100 === 0) console.log(`  ${stats.totalMessages} msgs in ${((now - stats.firstMessageAt) / 1000).toFixed(1)}s`);
  } catch {}
});
