# Data Requirements — Hormuz Crisis Intelligence Platform

All data is **snapshot-based** — fetched on demand, not live-streamed.
Run `node server/collect.js` to refresh everything.

## 1. Ship Positions (ship-positions.json)
Current vessel positions in the Persian Gulf / Strait of Hormuz / Gulf of Oman / Arabian Sea.

**Fields per ship:**
- MMSI, name, flag, ship type (cargo/tanker/tug/passenger/military)
- lat, lon, speed (knots), course (degrees), heading
- destination, length, width, DWT
- timestamp of last report

**Coverage:** Bounding box 20-32°N, 46-62°E (entire Gulf + approaches)
**Minimum:** 1000+ vessels for meaningful analysis
**Source options:**
- MarineTraffic HAR capture (proven — got 5617 ships)
- AISStream.io snapshot (API key available, but connection issues)
- AISHub.net (community shared)
- VesselFinder free data

## 2. Conflict Events (conflict-events.json)
Geolocated military/conflict events in the region.

**Fields per event:**
- id, type (strike/interception/vessel_attack/infrastructure_damage/military_sighting)
- lat, lon, timestamp
- title, description, source URL
- severity (1-5), confidence (verified/high/medium/low)
- casualties (if known)

**Coverage:** Last 14 days, Iran/Gulf region
**Source options:**
- liveuamap.com AJAX endpoint (proven — got 25 events with coords)
- iranwarlive.com/feed.json (proven — got 8 theater events)
- ACLED API (free account required)
- Wikipedia 2026 Strait of Hormuz crisis article

## 3. Infrastructure Status (infrastructure-status.json)
Status of critical energy/port infrastructure.

**Fields per facility:**
- name, lat, lon, type (oil_terminal/refinery/gas_terminal/pipeline/port)
- country, status (operational/degraded/damaged/destroyed/unknown)
- capacity (bbl/day or bcm/year), current_throughput_estimate
- last_verified timestamp, source of status report

**Facilities to track:**
- Iranian: Kharg Island, Lavan, Sirri, Bandar Abbas, Bushehr, Assaluyeh, Abadan, Isfahan, Jask
- UAE: ADNOC Ruwais, Fujairah, Jebel Ali, Abu Dhabi
- Saudi: Ras Tanura, Dammam, Jubail
- Qatar: Ras Laffan, Doha
- Oman: Sohar, Muscat, Duqm
- Bahrain: Sitra
- Kuwait: Shuaiba
- Bypass routes: Habshan-Fujairah pipeline, East-West Petroline

**Source options:**
- liveuamap events (damage reports with coords)
- News articles (BBC, Al Jazeera, Reuters)
- Wikipedia crisis article (infrastructure damage section)
- Manual curation from OSINT

## 4. News Headlines (news.json)
Recent news articles about the crisis.

**Fields per article:**
- title, description, source, url, published timestamp
- relevance keywords matched

**Coverage:** Last 7 days
**Source options:**
- Google News RSS (blocked — 403)
- BBC Middle East RSS (proven — 39 articles)
- Al Jazeera RSS (proven — 14 articles)
- Reddit r/CredibleDefense, r/geopolitics (proven — 32 posts)

## 5. Crisis Metrics (crisis-metrics.json)
Quantitative indicators for the scoring engine.

**Fields:**
- strait_transits_per_day (current vs baseline 153)
- oil_flow_bbl_per_day (current vs baseline 20M)
- lng_flow_bcm_per_year (current vs baseline 110)
- war_risk_insurance_pct (current premium)
- brent_crude_price_usd
- vessels_stranded_count
- vessels_stranded_dwt
- bypass_pipeline_utilization_pct

**Source options:**
- Computed from ship position data
- Oil prices: free API (exchangerate-api, or scrape from tradingeconomics)
- Insurance rates: news articles
- Wikipedia crisis article (has transit count data)

## 6. Supply Chain Baselines (supply-chain-baselines.json)
Static reference data for supply chain impact calculations.

**Already researched** in research/supply-chain-impacts.md:
- Oil: 20M bbl/day through Hormuz
- LNG: 110 bcm/year (Qatar)
- Bypass: Fujairah 1.5M + Petroline 5M = 6.5M theoretical, 2.6M actual
- Sulfur: 49% of global urea, 30% ammonia
- TSMC: 30-60 day chemical stockpiles
- Gulf food: 10 days Dubai fresh supply
- Fertilizer: spring planting season critical

This can be a static JSON file — doesn't need fetching.
