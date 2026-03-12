// Web Worker for AISStream.io WebSocket processing
// Handles connection, parsing, and batching — sends updates to main thread

let ws = null;
let apiKey = '';
let bbox = null;
let reconnectDelay = 2000;
let batch = [];
let batchTimer = null;
const BATCH_INTERVAL = 500; // send batch every 500ms

function flushBatch() {
  if (batch.length > 0) {
    postMessage({ type: 'batch', ships: batch });
    batch = [];
  }
}

function connect() {
  if (ws && ws.readyState < 2) return;

  ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.onopen = () => {
    reconnectDelay = 2000;
    postMessage({ type: 'status', connected: true });
    if (bbox) {
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [bbox],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport']
      }));
    }
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      const meta = msg.MetaData || {};
      const mmsi = String(meta.MMSI || '');
      if (!mmsi) return;

      const pos = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport;
      if (pos) {
        batch.push({
          mmsi,
          lat: meta.latitude,
          lon: meta.longitude,
          sog: pos.Sog || 0,
          cog: pos.Cog || pos.TrueHeading || 0,
          name: meta.ShipName || '',
          shipType: meta.ShipType || 0,
          destination: meta.Destination || '',
          ts: Date.now()
        });
      }

      const stat = msg.Message?.ShipStaticData;
      if (stat) {
        postMessage({
          type: 'static',
          mmsi,
          name: stat.Name || '',
          destination: stat.Destination || '',
          shipType: stat.Type || 0,
          imo: stat.ImoNumber || 0,
          callSign: stat.CallSign || '',
          dimA: stat.Dimension?.A || 0,
          dimB: stat.Dimension?.B || 0,
          dimC: stat.Dimension?.C || 0,
          dimD: stat.Dimension?.D || 0
        });
      }
    } catch (err) {
      // Skip malformed messages
    }
  };

  ws.onclose = () => {
    postMessage({ type: 'status', connected: false });
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
  };

  ws.onerror = () => { ws.close(); };
}

// Flush batch on interval
batchTimer = setInterval(flushBatch, BATCH_INTERVAL);

// Handle messages from main thread
onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    apiKey = msg.apiKey;
    bbox = msg.bbox;
    connect();
  } else if (msg.type === 'bbox') {
    bbox = msg.bbox;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [bbox],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport']
      }));
    }
  } else if (msg.type === 'disconnect') {
    if (ws) ws.close();
  }
};
