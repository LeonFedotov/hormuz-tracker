# Architecture Plan: Hormuz Crisis Intelligence Platform
Created: 2025-03-10
Author: architect-agent

## Overview

Transform the current single-file Hormuz tracker (1224-line `index.html` with inline CSS/JS, static HAR ship data, and a prototype AIS WebSocket worker) into a modular intelligence platform. The platform will combine shipping flow analysis, supply chain impact scoring, conflict event mapping, and multi-source OSINT aggregation — all with drill-down capability from macro indicators to individual vessels and events.

The migration is incremental: each phase produces a working deployment, and the existing HAR-snapshot viewer remains functional throughout.

---

## Current State Assessment

### What exists
| Component | File(s) | Size | Notes |
|-|-|-|-|
| Main UI | `index.html` | 1224 lines | Monolith: CSS + HTML + JS. Leaflet map, Tabulator table, analysis panel |
| Ship data | `ship_data.js` (727KB), `ships_*.json` | ~3.5MB total | Static HAR export from MarineTraffic |
| AIS worker | `ais-worker.js` | 110 lines | WebSocket to aisstream.io, batches to main thread |
| Baseline tool | `capture-baseline.js` | 107 lines | Node.js script, 3-min AIS collection |
| HAR pipeline | `extract_har.py`, `filter_strait.py`, `build_map.py`, etc. | ~6 scripts | Python, one-shot data extraction |
| IndexedDB | In `index.html` | ~30 lines | `hormuz-tracks` DB, positions store, 24h TTL |
| Research | `research/*.md` | 2 files | Competitor analysis, OSINT source catalog |

### What works well (keep)
- Canvas-rendered Leaflet with custom triangle/diamond markers — performant at 5600+ ships
- Ship classification logic (INBOUND_IR, OUTBOUND_IR, TRANSIT_W/E, STRANDED, IDLE, SUPPORT, DARK)
- Destination region parsing (regex-based port matching)
- Port-ship linking with visual polylines
- Viewport-synced Tabulator with grouping, filtering, sorting
- AIS WebSocket worker with batching, reconnect, age-out
- Dark/light theme via CSS custom properties
- Resizable pane layout

### What needs replacing
- Inline everything in one HTML file
- Static data only (HAR snapshot frozen in time)
- No event/incident layer
- No scoring system
- No data aggregation backend
- No persistence beyond 24h IndexedDB

---

## Key Architecture Decisions

### Decision 1: Add a lightweight backend

**Yes — Node.js server is required.** Rationale:

1. **API keys cannot live in client code.** The current `index.html` embeds AIS API keys in plaintext. Every adapter (AISStream, RSS feeds, Reddit, news APIs) needs server-side key management.
2. **Data aggregation must be continuous.** Scrapers, WebSocket consumers, and RSS pollers need to run 24/7, not just when someone has the page open.
3. **Historical data requires persistent storage.** IndexedDB is per-browser, per-device, capped, and dies with cache clears.
4. **Scoring computations need a stable baseline.** Client-side scoring would recompute from scratch on every page load.

**Stack:** Fastify (lightweight, schema-validated, excellent WebSocket support) on Node.js. Not Express — Fastify's JSON serialization is significantly faster for the data volumes we're pushing (thousands of ship positions per minute).

### Decision 2: Storage — SQLite via better-sqlite3

**SQLite, not Postgres.** Rationale:

1. Single-server deployment (this is a dashboard, not a SaaS product)
2. Zero ops overhead — no separate database process
3. `better-sqlite3` is synchronous and fast (300K+ inserts/sec)
4. WAL mode handles concurrent reads during writes
5. Easy to back up (single file, `cp` or `.backup`)
6. If we outgrow it, the schema ports cleanly to Postgres

**Schema outline:**
```sql
-- Ship positions (time-series, heavy write)
CREATE TABLE positions (
  id INTEGER PRIMARY KEY,
  mmsi TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  sog REAL,
  cog REAL,
  timestamp INTEGER NOT NULL,  -- unix ms
  source TEXT NOT NULL          -- 'aisstream', 'har', 'marinetraffic'
);
CREATE INDEX idx_pos_mmsi ON positions(mmsi);
CREATE INDEX idx_pos_ts ON positions(timestamp);
CREATE INDEX idx_pos_source ON positions(source);

-- Ship metadata (slow-changing)
CREATE TABLE vessels (
  mmsi TEXT PRIMARY KEY,
  imo TEXT,
  name TEXT,
  flag TEXT,
  ship_type INTEGER,
  length REAL,
  width REAL,
  dwt REAL,
  destination TEXT,
  dest_region TEXT,
  category TEXT,  -- INBOUND_IR, STRANDED, etc.
  first_seen INTEGER,
  last_seen INTEGER,
  source TEXT,
  data JSON    -- overflow fields
);

-- Normalized events (incidents, news, military, etc.)
CREATE TABLE events (
  id TEXT PRIMARY KEY,  -- uuid or source-specific ID
  type TEXT NOT NULL,   -- ship_position, incident, infrastructure_damage, military_sighting, news, transit_count
  lat REAL,
  lon REAL,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL,  -- verified, high, medium, low, unverified
  title TEXT,
  description TEXT,
  data JSON,
  created_at INTEGER DEFAULT (unixepoch('now') * 1000)
);
CREATE INDEX idx_evt_type ON events(type);
CREATE INDEX idx_evt_ts ON events(timestamp);
CREATE INDEX idx_evt_source ON events(source);

-- Scoring snapshots (computed periodically)
CREATE TABLE scores (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  transit_score REAL,      -- 0-100
  supply_chain_risk REAL,  -- 0-100
  conflict_intensity REAL, -- 0-100
  crisis_score REAL,       -- 0-100 weighted composite
  components JSON          -- breakdown of inputs
);
CREATE INDEX idx_score_ts ON scores(timestamp);

-- Baselines for comparison
CREATE TABLE baselines (
  metric TEXT PRIMARY KEY,     -- 'daily_transits', 'daily_tanker_dwt', etc.
  value REAL NOT NULL,
  period TEXT,                 -- '2024_avg', 'pre_crisis', etc.
  updated_at INTEGER
);
```

**Retention policy:** Keep raw positions for 30 days, aggregate to hourly/daily summaries, keep summaries indefinitely. Events kept indefinitely. Prune with a daily cron job.

### Decision 3: Frontend — Vite + vanilla ES modules

**Not React. Not Preact. Vanilla JS with Vite as the build tool.** Rationale:

1. The current code is already vanilla JS and works well. Rewriting 1200 lines into React components would take a week and add no capability.
2. Leaflet is not React-friendly (react-leaflet is a leaky abstraction that fights the imperative Leaflet API).
3. Tabulator has its own DOM management — wrapping it in React creates double-rendering issues.
4. The team is one person. Framework overhead (JSX, hooks, state management, build config) slows iteration.
5. Vite gives us: ES module imports, hot reload, env vars, TypeScript (optional), tree-shaking, and production bundling — all the build-tool benefits without framework lock-in.

**What Vite enables:**
- Split `index.html` into `src/main.js`, `src/map.js`, `src/table.js`, `src/dashboard.js`, `src/scoring.js`, `src/adapters/*.js`
- Import Leaflet/Tabulator as npm packages instead of CDN scripts
- `.env` file for API keys (excluded from git)
- CSS in separate files with hot reload
- Future option to adopt Lit, Preact, or Svelte for specific components without rewriting everything

### Decision 4: Adapter pattern — server-side, not client-side

All data adapters run on the server. The client receives normalized data via REST/WebSocket.

```
Client (browser)
  ↕ REST API (polling /api/dashboard, /api/events, /api/ships)
  ↕ WebSocket (live ship positions, new events)
Server (Fastify)
  ↕ Adapter Manager (schedules, runs, normalizes)
  ├── AISStream adapter (WebSocket consumer, always-on)
  ├── RSS adapter (polls every 5 min)
  ├── Reddit adapter (polls every 10 min)
  ├── MarineTraffic HAR adapter (manual import)
  ├── Manual events adapter (REST endpoint for manual entry)
  └── Future: LiveUAMap scraper, FleetLeaks, satellite
```

---

## Normalized Data Contract

Every adapter outputs events conforming to this interface:

```typescript
interface DataEvent {
  id: string;                    // Source-specific unique ID (or generated UUID)
  type: 'ship_position'
      | 'incident'
      | 'infrastructure_damage'
      | 'military_sighting'
      | 'news'
      | 'transit_count'
      | 'score_update';
  lat: number | null;            // Null for non-geographic events (e.g., news without location)
  lon: number | null;
  timestamp: number;             // Unix ms
  source: string;                // Adapter name: 'aisstream', 'reddit', 'rss', 'manual', etc.
  confidence: 'verified' | 'high' | 'medium' | 'low' | 'unverified';
  title?: string;                // Human-readable headline
  description?: string;          // Longer text
  data: Record<string, any>;     // Source-specific payload
}
```

**Confidence assignment rules:**
| Source | Default | Can upgrade to |
|-|-|-|
| AISStream (position) | `high` | `verified` (corroborated by 2+ receivers) |
| MarineTraffic HAR | `high` | — |
| Reuters/Lloyd's RSS | `high` | `verified` (if cross-referenced) |
| Reddit (CredibleDefense) | `medium` | `high` (if linked to primary source) |
| Reddit (other) | `low` | `medium` (if corroborated) |
| Manual entry | `medium` | `verified` (after review) |
| LiveUAMap scraper | `medium` | `high` (if sourced from official) |
| FleetLeaks sanctions | `verified` | — (sourced from OFAC/EU lists) |
| Satellite SAR detection | `high` | `verified` (with AIS correlation) |

---

## Adapter Specifications

### 1. AISStream Adapter (`adapters/aisstream.js`)

**Already prototyped** in `ais-worker.js` and `capture-baseline.js`. Move to server.

```
Connection: WebSocket wss://stream.aisstream.io/v0/stream
Auth: API key (env var AIS_STREAM_KEY)
BBox: [[22.0, 48.0], [30.0, 60.0]] (Persian Gulf + Gulf of Oman)
Message types: PositionReport, ShipStaticData, StandardClassBPositionReport
Output: ship_position events + vessel metadata upserts
Rate: ~50-200 msgs/sec in this bbox
```

**Server-side processing:**
1. Maintain in-memory Map of latest position per MMSI (same as current `liveShips`)
2. Batch-insert positions to SQLite every 5 seconds
3. Upsert vessel metadata on ShipStaticData messages
4. Forward deduplicated position updates to connected WebSocket clients every 500ms
5. Compute transit counts: count unique MMSIs crossing a Strait gate line (26.0-26.5N, 56.0-56.7E) per hour

### 2. MarineTraffic HAR Adapter (`adapters/marinetraffic.js`)

**Already implemented** in `extract_har.py`. Rewrite in JS, add to server as import endpoint.

```
Input: HAR file upload via POST /api/import/har
Processing: Parse get_data_json responses, extract ship rows
Output: ship_position events (one per ship, snapshot timestamp)
         vessel metadata upserts
```

### 3. News RSS Adapter (`adapters/news-rss.js`)

```
Sources:
  - Reuters Middle East: https://www.reuters.com/arc/outboundfeeds/v3/all/category/middle-east/?outputType=xml
  - Lloyd's List: manual RSS URL or scraper
  - Al Jazeera: https://www.aljazeera.com/xml/rss/all.xml
  - BBC Middle East: http://feeds.bbci.co.uk/news/world/middle_east/rss.xml
Poll interval: 5 minutes
Filter: Keywords ["hormuz", "strait", "iran", "persian gulf", "tanker", "naval",
         "blockade", "sanctions", "oil price", "shipping disruption"]
Output: news events with confidence 'high'
Deduplication: By URL (normalized)
```

### 4. Reddit Adapter (`adapters/reddit.js`)

```
Subreddits: r/CredibleDefense, r/OSINT, r/geopolitics, r/shipping
API: Reddit JSON API (append .json to listing URLs, no auth needed for read)
     e.g., https://www.reddit.com/r/CredibleDefense/new.json?limit=25
Poll interval: 10 minutes
Filter: Same keywords as RSS + ["hormuz", "IRGCN", "carrier group", "5th fleet"]
Output: news events with confidence 'low' or 'medium'
Geo-coding: Extract lat/lon from text if present, otherwise null
```

### 5. Manual Events Adapter (`adapters/manual-events.js`)

```
Input: POST /api/events with JSON body
Auth: Simple shared secret in header (not public-facing)
Types: incident, infrastructure_damage, military_sighting
Required: type, title, timestamp
Optional: lat, lon, description, confidence, source URL
Use case: User enters "Bandar Abbas port crane hit by missile" with coordinates
```

### 6. FleetLeaks Adapter (`adapters/fleetleaks.js`) — Future

```
Source: https://fleetleaks.com (scrape vessel list, or check for API)
Data: Sanctioned vessel MMSIs, flag-hopping history, AIS gap scores
Refresh: Daily
Output: Enrichment data — flag sanctioned vessels in the vessel table
```

### 7. LiveUAMap Adapter (`adapters/liveuamap.js`) — Future

```
Source: https://liveuamap.com (scrape event markers)
Data: Conflict events with coordinates
Refresh: 15 minutes
Output: incident / military_sighting events
Confidence: medium (aggregator, not primary source)
```

---

## Scoring System Design

### Transit Score (0-100)

Measures: Are ships still transiting the Strait?

```
transit_score = (current_daily_transits / baseline_daily_transits) * 100
```

| Input | Source | Notes |
|-|-|-|
| `current_daily_transits` | AISStream gate-line counter | Unique MMSIs crossing 26.0-26.5N, 56.0-56.7E in 24h |
| `baseline_daily_transits` | `baselines` table | Pre-crisis average: ~60 transits/day (from hormuzstraitmonitor data) |

**Score interpretation:**
- 90-100: Normal flow
- 60-89: Reduced traffic
- 30-59: Severely disrupted
- 0-29: Effectively blocked

**Breakdowns stored in `components` JSON:**
- Tanker transits vs baseline
- Cargo transits vs baseline
- Inbound vs outbound ratio
- Iran-flagged vs foreign-flagged

### Supply Chain Risk Score (0-100)

Measures: How badly are downstream supply chains affected?

```
supply_chain_risk = weighted_average(
  0.35 * oil_flow_disruption,      // Tanker DWT through Strait vs baseline
  0.25 * stranded_vessel_ratio,    // Stranded DWT / total DWT in zone
  0.20 * port_congestion,          // Vessels waiting vs normal dwell time
  0.10 * foc_anomaly,              // FOC fleet behavior deviation
  0.10 * destination_diversity     // Concentration of destinations (entropy measure)
)
```

| Component | Calculation |
|-|-|
| `oil_flow_disruption` | `100 - (current_tanker_dwt_24h / baseline_tanker_dwt_24h) * 100` |
| `stranded_vessel_ratio` | `(stranded_dwt / total_dwt) * 100`, capped at 100 |
| `port_congestion` | Vessels at anchor with destination set, normalized against baseline |
| `foc_anomaly` | Deviation of FOC vessel count from historical mean |
| `destination_diversity` | Shannon entropy of destination regions, inverted and normalized |

### Conflict Intensity Score (0-100)

Measures: How active is the military/conflict situation?

```
conflict_intensity = time_decayed_sum(
  events.filter(type in ['incident', 'infrastructure_damage', 'military_sighting'])
    .map(e => severity_weight(e) * confidence_weight(e) * time_decay(e))
) / normalizing_constant
```

| Event type | Severity weight |
|-|-|
| `infrastructure_damage` (port, terminal) | 10 |
| `incident` (vessel struck) | 8 |
| `military_sighting` (carrier group, submarine) | 5 |
| `incident` (near-miss, warning) | 3 |
| `military_sighting` (patrol boat) | 2 |

| Confidence | Weight |
|-|-|
| `verified` | 1.0 |
| `high` | 0.8 |
| `medium` | 0.5 |
| `low` | 0.2 |
| `unverified` | 0.1 |

**Time decay:** `e^(-t/48h)` — events older than 48h decay to near-zero. Recent events dominate.

### Overall Crisis Score (0-100)

```
crisis_score = 0.40 * (100 - transit_score)   // Low transit = high crisis
             + 0.30 * supply_chain_risk
             + 0.30 * conflict_intensity
```

**Computation schedule:** Every 5 minutes. Store snapshot to `scores` table. Frontend polls or receives via WebSocket.

---

## API Design

### REST Endpoints

```
GET  /api/dashboard
  → { scores: {...}, vessel_summary: {...}, recent_events: [...], last_updated: ... }
  Used for: Initial page load, polling (60s interval)

GET  /api/ships?bbox=S,W,N,E&source=aisstream&limit=5000
  → { ships: [...], total: N }
  Used for: Map viewport filtering

GET  /api/ships/:mmsi
  → { vessel: {...}, positions: [...], events: [...] }
  Used for: Ship drill-down panel

GET  /api/ships/:mmsi/track?hours=24
  → { points: [[lat, lon, ts], ...] }
  Used for: Ship trail on map

GET  /api/events?type=incident&since=1710000000000&limit=50
  → { events: [...], total: N }
  Used for: Event timeline, incident layer

GET  /api/scores?hours=168
  → { scores: [{timestamp, transit_score, supply_chain_risk, ...}, ...] }
  Used for: Score trend sparklines

POST /api/events
  → { id: "..." }
  Used for: Manual event entry

POST /api/import/har
  → { imported: N, vessels: N }
  Used for: HAR file upload
```

### WebSocket

```
ws://localhost:3001/ws

Server → Client messages:
  { type: 'ship_update', ships: [{mmsi, lat, lon, sog, cog, name, ...}] }  // every 500ms
  { type: 'new_event', event: {...} }                                       // on new event
  { type: 'score_update', scores: {...} }                                   // every 5 min

Client → Server messages:
  { type: 'subscribe', bbox: [[S,W],[N,E]] }   // Filter ship updates to viewport
  { type: 'unsubscribe' }
```

---

## Frontend Module Structure

```
src/
  main.js           — App bootstrap, API client, WebSocket connection
  map.js            — Leaflet map, layers, markers, popups, linking
  table.js          — Tabulator setup, viewport sync, grouping
  dashboard.js      — Flow stats panel (left), computed from API data
  analysis.js       — Situation assessment panel (right)
  scoring.js        — Score display widgets, sparklines, trend indicators
  events.js         — Event timeline UI, incident markers on map
  adapters/
    api-client.js   — REST API wrapper (fetch-based)
    ws-client.js    — WebSocket connection manager (replaces ais-worker.js)
  utils/
    classify.js     — Ship classification logic (extracted from index.html)
    geo.js          — destRegion(), findDestPort(), gate-line crossing
    format.js       — Number formatting, time formatting
    theme.js        — Dark/light theme management
  styles/
    base.css        — Reset, variables, layout
    map.css         — Leaflet overrides, popups, port labels
    table.css       — Tabulator theme overrides
    dashboard.css   — Stats panels, bars, legends
    scoring.css     — Score widgets, sparklines
```

The `index.html` becomes a thin shell:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hormuz Crisis Intelligence</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

---

## Implementation Phases

### Phase 0: Project Scaffolding
**Goal:** Set up Vite, extract modules from index.html, working build with no new features.

**Files to create:**
- `package.json` — Vite, Leaflet, Tabulator as deps
- `vite.config.js` — Dev server config
- `.env` — API keys (gitignored)
- `.gitignore` — node_modules, dist, .env, *.db
- `src/main.js` — Import and init all modules
- `src/map.js` — Map initialization, layer management, custom markers
- `src/table.js` — Tabulator setup
- `src/dashboard.js` — Left panel stats
- `src/analysis.js` — Right panel assessments
- `src/utils/classify.js` — CATS, destRegion, classification logic
- `src/utils/geo.js` — Port definitions, matching
- `src/utils/format.js` — fmt(), number formatting
- `src/utils/theme.js` — Theme toggle
- `src/styles/*.css` — Extracted from inline `<style>`

**Acceptance criteria:**
- [ ] `pnpm dev` serves the app with hot reload
- [ ] All current features work identically
- [ ] `ship_data.js` still loads as static data
- [ ] No inline JavaScript in HTML
- [ ] API keys in `.env`, not in source

**Effort:** Small (1-2 sessions). Mechanical extraction, no logic changes.

### Phase 1: Backend Foundation
**Goal:** Fastify server with SQLite, serve existing static data, WebSocket proxy for AIS.

**Files to create:**
```
server/
  index.js           — Fastify server, route registration
  db.js              — SQLite connection, schema migration
  schema.sql         — Table definitions
  routes/
    dashboard.js     — GET /api/dashboard
    ships.js         — GET /api/ships, /api/ships/:mmsi
    events.js        — GET/POST /api/events
    import.js        — POST /api/import/har
  adapters/
    base.js          — Abstract adapter class
    aisstream.js     — WebSocket consumer (moved from ais-worker.js)
    har-import.js    — HAR parser (ported from extract_har.py)
  scoring/
    engine.js        — Score computation, scheduling
    baselines.js     — Baseline data management
  ws.js              — WebSocket server, client management, broadcast
```

**Dependencies:** `fastify`, `@fastify/websocket`, `@fastify/cors`, `@fastify/static`, `@fastify/multipart`, `better-sqlite3`, `ws` (for AISStream client), `uuid`

**Acceptance criteria:**
- [ ] Server starts, connects to AISStream, stores positions in SQLite
- [ ] `/api/dashboard` returns current vessel summary
- [ ] `/api/ships?bbox=...` returns ships in viewport
- [ ] WebSocket broadcasts live positions to connected clients
- [ ] HAR import endpoint processes uploaded files
- [ ] Frontend can switch between static data and API data

**Effort:** Medium (2-3 sessions).

### Phase 2: News & Event Ingestion
**Goal:** RSS and Reddit adapters producing normalized events. Event layer on map.

**Files to create:**
```
server/adapters/
  news-rss.js        — RSS poller with keyword filtering
  reddit.js          — Reddit JSON API poller
server/adapters/
  manager.js         — Adapter lifecycle (start, stop, schedule, health)
src/
  events.js          — Event timeline panel, map markers for incidents
  src/styles/events.css
```

**Dependencies:** `rss-parser` (or raw XML parsing with `fast-xml-parser`)

**Acceptance criteria:**
- [ ] RSS adapter polls 4+ feeds, filters by keywords, deduplicates by URL
- [ ] Reddit adapter polls 4 subreddits, filters, assigns confidence
- [ ] Events appear in `/api/events` endpoint
- [ ] Map shows event markers (colored by type, sized by severity)
- [ ] Event timeline panel shows chronological list with source attribution
- [ ] Clicking an event flies to location on map

**Effort:** Medium (2 sessions).

### Phase 3: Scoring Engine
**Goal:** Compute all four scores, display in dashboard with trend lines.

**Files to create/modify:**
```
server/scoring/
  transit.js         — Transit score computation
  supply-chain.js    — Supply chain risk computation
  conflict.js        — Conflict intensity computation
  composite.js       — Overall crisis score
src/
  scoring.js         — Score display widgets
  src/styles/scoring.css
```

**Acceptance criteria:**
- [ ] Scores computed every 5 minutes, stored in `scores` table
- [ ] `/api/scores?hours=168` returns 7 days of score history
- [ ] Dashboard shows 4 score gauges (0-100, color-coded)
- [ ] Each score has a 7-day sparkline trend
- [ ] Score breakdown available on hover/click
- [ ] Baseline values configurable via API or config file

**Effort:** Medium (2 sessions).

### Phase 4: Drill-Down & Ship Detail
**Goal:** Click any ship to see full history, track, events, risk profile.

**Files to create/modify:**
```
src/
  ship-detail.js     — Slide-out panel with ship deep-dive
  src/styles/detail.css
server/routes/
  ships.js           — Add /api/ships/:mmsi/track, enrich with events
```

**Features:**
- Ship detail panel slides out from right side
- Full 30-day position history with playback slider
- Events associated with this vessel (by MMSI or proximity)
- Sanctions check (if MMSI appears in FleetLeaks data)
- Port call history (derived from position data — dwell time at port coordinates)
- AIS gap detection (periods with no position reports)

**Acceptance criteria:**
- [ ] Clicking ship on map or table opens detail panel
- [ ] Track history renders on map with time coloring
- [ ] AIS gaps highlighted
- [ ] Associated events listed

**Effort:** Medium (2 sessions).

### Phase 5: Manual Events & Conflict Layer
**Goal:** Input interface for manual events (bombings, strikes), dedicated conflict map layer.

**Files to create/modify:**
```
src/
  event-entry.js     — Manual event entry form
  conflict-layer.js  — Dedicated map layer for military/conflict events
server/adapters/
  manual-events.js   — Validation, geocoding
```

**Features:**
- Modal form for entering events with type, location (click map to place pin), title, description, source URL
- Conflict layer with distinct iconography: explosion icons, ship-strike icons, military vessel triangles
- Time-based filtering (show last 24h, 7d, 30d)
- Event clustering at low zoom levels

**Acceptance criteria:**
- [ ] Manual events saved via API, appear on map and timeline
- [ ] Conflict layer toggleable independently
- [ ] Events clustered at low zoom
- [ ] Time filter works across all event sources

**Effort:** Small-Medium (1-2 sessions).

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────┐
                    │         Data Sources             │
                    │                                  │
                    │  AISStream ─┐                    │
                    │  RSS Feeds ─┤                    │
                    │  Reddit ────┤    (adapters)      │
                    │  HAR Import ┤                    │
                    │  Manual ────┤                    │
                    │  FleetLeaks ┘                    │
                    └────────────┬────────────────────┘
                                 │ DataEvent[]
                                 ▼
                    ┌─────────────────────────────────┐
                    │         Server (Fastify)          │
                    │                                  │
                    │  Adapter Manager                 │
                    │    → normalize, validate         │
                    │    → deduplicate                 │
                    │    → confidence scoring          │
                    │         │                        │
                    │         ▼                        │
                    │  SQLite (better-sqlite3)         │
                    │    positions │ vessels │ events   │
                    │    scores   │ baselines          │
                    │         │                        │
                    │         ├──→ Scoring Engine       │
                    │         │    (every 5 min)       │
                    │         │                        │
                    │         ├──→ REST API             │
                    │         │    /api/dashboard       │
                    │         │    /api/ships           │
                    │         │    /api/events          │
                    │         │    /api/scores          │
                    │         │                        │
                    │         └──→ WebSocket Server     │
                    │              (live positions,     │
                    │               new events,        │
                    │               score updates)     │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │        Frontend (Vite + Vanilla)  │
                    │                                  │
                    │  ┌──────────────────────────┐   │
                    │  │   Leaflet Map             │   │
                    │  │   • Ship markers (canvas)  │   │
                    │  │   • Event markers          │   │
                    │  │   • Port diamonds          │   │
                    │  │   • Conflict layer         │   │
                    │  │   • Ship-port links        │   │
                    │  └──────────────────────────┘   │
                    │  ┌──────┬──────────┬──────────┐ │
                    │  │Scores│ Tabulator│ Analysis │ │
                    │  │Panel │  Table   │  Panel   │ │
                    │  └──────┴──────────┴──────────┘ │
                    │  ┌──────────────────────────┐   │
                    │  │  Event Timeline (bottom)   │   │
                    │  └──────────────────────────┘   │
                    └─────────────────────────────────┘
```

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|-|-|-|-|
| AISStream free tier rate limits or goes down | No live data | Medium | Cache last-known positions in SQLite. Fallback to HAR snapshots. Add AISHub as secondary source. |
| SQLite write contention under heavy AIS load | Slow inserts, data loss | Low | WAL mode + batch inserts every 5s. If truly bottlenecked, queue writes with an in-memory buffer. |
| Reddit API rate limiting | Missing OSINT events | Medium | Use unauthenticated JSON API (60 req/min). Cache responses. Add Telegram as alternative channel. |
| RSS feeds have no Hormuz-specific content | Empty event stream | Medium | Broad keyword list. Add manual events as primary during quiet periods. |
| Single-file SQLite corrupts | Total data loss | Very Low | Daily backup to timestamped file. WAL mode + PRAGMA journal_mode=WAL. Consider write-ahead checkpoint schedule. |
| Scope creep into satellite imagery processing | Unbounded complexity | Medium | Defer SAR processing to Phase 6+. Focus on AIS + text-based OSINT first. Satellite is a data source to integrate later, not to build ourselves. |
| Browser performance with thousands of live markers | UI jank | Low-Medium | Already using Canvas renderer. Server-side viewport filtering via bbox parameter. Send only delta updates via WebSocket. |

---

## Open Questions

- [ ] **AISStream API key limits?** Free tier is "unlimited" per docs but unclear under sustained load. Need to test 24/7 connection stability.
- [ ] **Oil price feed?** The scoring system would benefit from live Brent crude. EIA API is free but daily granularity. Yahoo Finance undocumented endpoint might work for intraday.
- [ ] **War risk insurance data?** Lloyd's Market Association publishes JWC (Joint War Committee) listed areas. This is public but not machine-readable. Manual input for now.
- [ ] **Deploy where?** Single VPS (Hetzner, DigitalOcean) is cheapest. Could also do a free tier Render/Railway for the server + static frontend on Vercel/Netlify.
- [ ] **Multi-user?** Currently single-user. If sharing publicly, need to remove manual event entry or add auth.

---

## Success Criteria

1. **Live dashboard loads in <3 seconds** with current scores, vessel summary, and map populated from server
2. **Ship positions update in real-time** via WebSocket (latency <2s from AIS reception to map marker move)
3. **Events from 3+ sources** appear on timeline within 10 minutes of publication
4. **All four scores** compute automatically and match intuitive assessment of situation
5. **Ship drill-down** shows full history, track, and associated events for any vessel
6. **No API keys in client-side code** — all secrets server-side
7. **30-day data retention** with queryable history
8. **Works offline** with last-cached data (graceful degradation when server is unreachable)

---

## Migration Path (Minimum Viable Change)

For someone who wants to start today with the smallest possible change:

1. **Create `vite.config.js` and `package.json`** — set up Vite to serve existing `index.html`
2. **Move API key to `.env`** — read via `import.meta.env.VITE_AIS_KEY`
3. **Extract `ship_data.js` loading** into an ES module import
4. **Add `server/index.js`** with just AISStream adapter + SQLite positions store
5. **Change frontend** to fetch from `/api/ships` instead of static `ship_data.js`

That gives you: a build system, server-side key management, and persistent data — all in ~200 lines of new code, with the existing 1224-line UI untouched.
