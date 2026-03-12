import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 15;

// Test with APIKey (capital K) instead of APIkey
const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
let count = 0;

const timeout = setTimeout(() => {
  console.log(`APIKey (capital K) result: ${count} messages`);
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  console.log("Testing with APIKey (capital K)...");
  socket.send(JSON.stringify({
    APIKey: API_KEY,
    BoundingBoxes: [[[20.0, 48.0], [30.0, 60.0]]],
  }));
});
socket.addEventListener("error", (e) => console.error("ERROR:", e.message));
socket.addEventListener("close", (e) => { console.log(`Closed: ${e.code} ${e.reason}`); clearTimeout(timeout); process.exit(0); });
socket.addEventListener("message", (event) => {
  count++;
  if (count <= 3) {
    const msg = JSON.parse(event.data);
    console.log(`  msg ${count}: ${msg.MessageType} | MMSI: ${msg.MetaData?.MMSI} | ${msg.MetaData?.ShipName?.trim()}`);
  }
  if (count % 50 === 0) console.log(`  ... ${count} messages`);
});
