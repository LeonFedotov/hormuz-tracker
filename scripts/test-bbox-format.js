import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 15;

// Test multiple bboxes simultaneously to find the right format
// Hormuz is around lat 26, lon 56
const tests = [
  { label: "latlon_narrow", bbox: [[25.5, 55.0], [27.0, 57.0]] },   // Original that worked
  { label: "latlon_wide", bbox: [[24.0, 54.0], [28.0, 58.0]] },     // Wider that failed  
];

// Run the working one again to confirm consistency
const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
let count = 0;

const timeout = setTimeout(() => {
  console.log(`\nNarrow bbox re-test: ${count} messages in 15s`);
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  // Use the wider one but with multiple bboxes
  console.log("Testing wide bbox again...");
  socket.send(JSON.stringify({ 
    APIkey: API_KEY, 
    BoundingBoxes: [[[24.0, 54.0], [28.0, 58.0]]]
  }));
});
socket.addEventListener("error", (e) => console.error("ERROR:", e.message));
socket.addEventListener("close", (e) => { console.log(`Closed: ${e.code} ${e.reason}`); clearTimeout(timeout); process.exit(0); });
socket.addEventListener("message", (event) => {
  count++;
  if (count <= 5) {
    const msg = JSON.parse(event.data);
    console.log(`  ${msg.MessageType} | ${msg.MetaData?.MMSI} | lat:${msg.MetaData?.latitude} lon:${msg.MetaData?.longitude}`);
  }
});
