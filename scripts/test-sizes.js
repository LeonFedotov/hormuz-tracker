import WebSocket from "ws";

const API_KEY = "2c26fe4b86125a11755a2c6ded3fb9aae2d68969";

async function testBbox(label, bbox, durationSec = 10) {
  return new Promise((resolve) => {
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
    let count = 0;
    const timeout = setTimeout(() => {
      console.log(`  ${label}: ${count} msgs`);
      socket.close();
      resolve(count);
    }, durationSec * 1000);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ APIkey: API_KEY, BoundingBoxes: [bbox] }));
    });
    socket.addEventListener("close", () => { clearTimeout(timeout); resolve(count); });
    socket.addEventListener("error", () => {});
    socket.addEventListener("message", () => { count++; });
  });
}

const tests = [
  ["world", [[-90, -180], [90, 180]]],
  ["narrow_hormuz", [[25.5, 55.0], [27.0, 57.0]]],
  ["medium_hormuz", [[24.0, 54.0], [28.0, 58.0]]],
  ["medium_europe", [[48.0, 0.0], [55.0, 10.0]]],
];

for (const [label, bbox] of tests) {
  console.log(`Testing ${label}: ${JSON.stringify(bbox)}`);
  await testBbox(label, bbox);
}
