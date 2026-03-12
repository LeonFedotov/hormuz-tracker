# Hormuz Crisis Intelligence Platform

## Project Overview
Maritime intelligence dashboard tracking the 2026 Strait of Hormuz crisis. Visualizes shipping disruption, supply chain impacts, conflict events, and infrastructure damage.

## Tech Stack
- **Frontend**: Vite + vanilla ES modules, Leaflet (canvas renderer), Tabulator
- **Data**: Static JSON files refreshed via Node.js adapter scripts
- **Scoring**: Custom crisis scoring engine + supply chain impact calculator
- **Tests**: Vitest, 234 tests

## Key Files
- `src/main.js` — app entry, loads ship data via fetch, initializes all modules
- `src/ships.js` — ship classification (CATS categories), parseShips(), ship type SVGs
- `src/map.js` — Leaflet init, custom canvas markers (Triangle, Diamond, Burst, Square, Hex, Pill)
- `src/ports.js` — 32 ports, port-ship linking, destination matching
- `data/ship-positions.json` — vessel positions (from MarineTraffic HAR capture)
- `data/conflict-events.json` — geolocated incidents
- `data/infrastructure-status.json` — 25 facilities with damage status
- `scoring/score.js` — crisis score computation
- `scoring/supply-chain.js` — supply chain impact analysis

## Data Format
Ship positions are JSON objects with fields: mmsi, name, flag, ship_type, ship_type_code, lat, lon, speed_kn, course, heading, destination, length, width, dwt, elapsed_sec, source, timestamp.

Ship type is a string ('cargo', 'tanker', 'tug', etc.) with numeric code in ship_type_code.

## Commands
- `pnpm dev` — Vite dev server
- `pnpm test` — run all tests
- `node server/collect.js` — refresh all data
- `node scripts/extract-har.cjs` — extract ships from MarineTraffic HAR file

## Conventions
- Use pnpm, never npm/yarn
- .cjs extension for CommonJS scripts (package.json has type:module)
- Data files go in data/, adapters in adapters/, scoring in scoring/
- All map markers use Leaflet canvas renderer (preferCanvas:true)
- CSS uses custom properties (--bg, --fg, etc.) for dark/light theme
- Ship silhouette SVGs in shipTypeSVG() adapt colors based on current theme
