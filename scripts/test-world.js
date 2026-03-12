import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 20;

const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
let count = 0;
let firstAt = null;
const types = {};

const timeout = setTimeout(() => {
  const dur = firstAt ? ((Date.now() - firstAt) / 1000).toFixed(1) : 0;
  console.log(`\nWorld subscription: ${count} msgs in ${dur}s (${dur > 0 ? (count/dur).toFixed(1) : 0} msg/s)`);
  console.log("Types:", JSON.stringify(types));
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  console.log("Subscribing to entire world...");
  socket.send(JSON.stringify({
    APIkey: API_KEY,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
  }));
});
socket.addEventListener("error", (e) => console.error("ERROR:", e.message));
socket.addEventListener("close", (e) => { console.log(`Closed: ${e.code} ${e.reason}`); clearTimeout(timeout); process.exit(0); });
socket.addEventListener("message", (event) => {
  count++;
  if (!firstAt) firstAt = Date.now();
  try {
    const msg = JSON.parse(event.data);
    types[msg.MessageType] = (types[msg.MessageType] || 0) + 1;
  } catch {}
  if (count <= 5) {
    try {
      const msg = JSON.parse(event.data);
      console.log(`  ${msg.MessageType} | MMSI:${msg.MetaData?.MMSI} | ${msg.MetaData?.ShipName?.trim()} | ${msg.MetaData?.latitude?.toFixed(2)},${msg.MetaData?.longitude?.toFixed(2)}`);
    } catch {}
  }
  if (count % 500 === 0) console.log(`  ... ${count} msgs`);
});
