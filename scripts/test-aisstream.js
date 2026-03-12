import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";
const DURATION_SEC = 30;
const BBOX = [[25.5, 55.0], [27.0, 57.0]]; // Hormuz area

const stats = {
  totalMessages: 0,
  byType: {},
  uniqueMMSIs: new Set(),
  firstMessageAt: null,
  lastMessageAt: null,
  errors: [],
  sampleMessages: [],
};

const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

const timeout = setTimeout(() => {
  console.log("\n--- 30 second test complete ---");
  printStats();
  socket.close();
  process.exit(0);
}, DURATION_SEC * 1000);

socket.addEventListener("open", () => {
  console.log(`[${ts()}] Connected. Sending subscription...`);
  const sub = {
    APIkey: API_KEY,
    BoundingBoxes: [BBOX],
  };
  socket.send(JSON.stringify(sub));
  console.log(`[${ts()}] Subscription sent. BBox: ${JSON.stringify(BBOX)}`);
  console.log(`[${ts()}] Listening for ${DURATION_SEC}s...\n`);
});

socket.addEventListener("error", (event) => {
  console.error(`[${ts()}] ERROR:`, event.message || event);
  stats.errors.push(String(event.message || event));
});

socket.addEventListener("close", (event) => {
  console.log(`[${ts()}] Connection closed. Code: ${event.code} Reason: ${event.reason}`);
  if (stats.totalMessages === 0) {
    console.log("No messages received. API key may be invalid or bbox may have no traffic.");
  }
  clearTimeout(timeout);
  printStats();
  process.exit(0);
});

socket.addEventListener("message", (event) => {
  const now = Date.now();
  stats.totalMessages++;
  if (!stats.firstMessageAt) stats.firstMessageAt = now;
  stats.lastMessageAt = now;

  try {
    const msg = JSON.parse(event.data);
    const type = msg.MessageType || "Unknown";
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Extract MMSI from metadata
    const mmsi = msg.MetaData?.MMSI;
    if (mmsi) stats.uniqueMMSIs.add(mmsi);

    // Keep first 3 samples
    if (stats.sampleMessages.length < 3) {
      stats.sampleMessages.push({
        type,
        mmsi,
        shipName: msg.MetaData?.ShipName?.trim(),
        lat: msg.MetaData?.latitude,
        lon: msg.MetaData?.longitude,
      });
    }

    // Progress indicator every 50 messages
    if (stats.totalMessages % 50 === 0) {
      const elapsed = ((now - stats.firstMessageAt) / 1000).toFixed(1);
      console.log(`  ... ${stats.totalMessages} messages in ${elapsed}s (${stats.uniqueMMSIs.size} unique vessels)`);
    }
  } catch (e) {
    stats.errors.push(`Parse error: ${e.message}`);
  }
});

function ts() {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

function printStats() {
  const duration = stats.firstMessageAt && stats.lastMessageAt
    ? ((stats.lastMessageAt - stats.firstMessageAt) / 1000).toFixed(1)
    : 0;
  const rate = duration > 0 ? (stats.totalMessages / duration).toFixed(2) : 0;

  console.log("\n========== RESULTS ==========");
  console.log(`Total messages:    ${stats.totalMessages}`);
  console.log(`Duration (data):   ${duration}s`);
  console.log(`Avg msg/sec:       ${rate}`);
  console.log(`Unique vessels:    ${stats.uniqueMMSIs.size}`);
  console.log(`Errors:            ${stats.errors.length}`);
  console.log(`\nMessage types:`);
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  if (stats.sampleMessages.length > 0) {
    console.log(`\nSample messages:`);
    for (const s of stats.sampleMessages) {
      console.log(`  ${s.type} | MMSI: ${s.mmsi} | ${s.shipName || "?"} | ${s.lat?.toFixed(4)}, ${s.lon?.toFixed(4)}`);
    }
  }
  if (stats.errors.length > 0) {
    console.log(`\nErrors:`);
    stats.errors.forEach(e => console.log(`  ${e}`));
  }
  console.log("=============================\n");
}
