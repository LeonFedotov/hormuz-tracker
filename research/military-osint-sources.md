# Military Vessel OSINT Sources

Generated: 2026-03-10

## Summary

This document catalogs open-source intelligence (OSINT) sources for tracking military and naval vessels. Sources range from free AIS-based platforms and community-driven databases to satellite imagery tools and sanctions-tracking projects. Military vessels frequently disable AIS transponders, so effective tracking requires combining AIS data with satellite imagery (SAR/optical), social media OSINT, and community spotters.

---

## 1. AIS-Based Vessel Tracking Platforms

### MarineTraffic
- **URL:** https://www.marinetraffic.com
- **Data:** Real-time AIS positions, vessel particulars, port calls, photos. 550k+ vessel database. 3 days historical (free), ~2 years (paid).
- **Military relevance:** Some warships broadcast AIS intermittently. Dedicated military vessel pages exist via third-party wrappers.
- **API:** Yes, paid. REST API for positions, port calls, vessel details (JSON). https://servicedocs.marinetraffic.com/
- **Currency:** Real-time.

### VesselFinder
- **URL:** https://www.vesselfinder.com
- **Data:** Real-time AIS, vessel database, port arrivals/departures.
- **API:** Yes, paid. JSON/XML. Positions, voyages, vessel particulars. https://api.vesselfinder.com/docs/
- **Currency:** Real-time.

### ShipXplorer
- **URL:** https://www.shipxplorer.com
- **Data:** Real-time AIS positions with broad global coverage including community-contributed AIS receivers.
- **API:** Not documented publicly.
- **Currency:** Real-time.

### FleetMon
- **URL:** https://www.fleetmon.com
- **Data:** Live AIS tracker, vessel database, port activity.
- **API:** Yes, paid tiers.
- **Currency:** Real-time.

### MyShipTracking
- **URL:** https://www.myshiptracking.com
- **Data:** Free real-time AIS tracking, distances, ETAs, port details.
- **API:** Yes. https://api.myshiptracking.com/
- **Currency:** Real-time.

---

## 2. Free / Community AIS Data Sources

### aisstream.io (Recommended - Free WebSocket API)
- **URL:** https://aisstream.io
- **Data:** Global real-time AIS stream via WebSocket. All AIS message types in JSON.
- **API:** Free. WebSocket at `wss://stream.aisstream.io/v0/stream`. Requires API key (free signup). Filter by bounding box, MMSI, or message type.
- **Code examples:** https://github.com/aisstream/example (Python, JS, Go, Rust, C, C++, C#)
- **Currency:** Real-time.
- **Programmatic:** Yes. Best free option for building custom tracking.

### AISHub
- **URL:** https://www.aishub.net
- **Data:** Community AIS data exchange. Contribute your AIS feed, get access to aggregated global feed.
- **API:** Yes, JSON/XML/CSV. https://www.aishub.net/api. Requires contributing an AIS data feed.
- **Currency:** Real-time.

### AISViz (Open Source)
- **URL:** https://github.com/AISViz
- **Data:** Open-source toolbox for raw AIS data extraction, processing, visualization, vessel modeling.
- **Programmatic:** Yes, Python tools.

### OpenAIS
- **URL:** https://open-ais.org
- **Data:** Tools to reduce time/skill needed to derive insight from raw AIS data.
- **Programmatic:** Yes, open-source.

### AIS.dk
- **URL:** https://www.ais.dk
- **Data:** Real-time ship positions from the AIS network (Danish-focused but global data).

---

## 3. Military-Specific Tracking Pages

### marinevesseltraffic.com - Military Ship Tracker
- **URL:** https://www.marinevesseltraffic.com/2013/02/military-ship-track.html
- **Data:** US and NATO warship positions on live maps. Searchable by country, type, class, hull number. Includes pennant numbers, photos, dimensions, homeports, IMO/MMSI.
- **Also:** US Navy warships: https://www.marinevesseltraffic.com/navy-ships
- **Programmatic:** No API. Scraping possible.

### shiplocation.com - Military Vessel Finder
- **URL:** https://www.shiplocation.com/military/tracker
- **Data:** Military ship positions, route, recent track, speed, destinations.
- **Programmatic:** No API.

### cruisingearth.com - Military Ship Tracker
- **URL:** https://www.cruisingearth.com/military-ship-tracker/
- **Data:** Free real-time military ship tracking worldwide.

### Hormuz Strait Specific
- **URL:** https://www.marinevesseltraffic.com/HORMUZ-STRAIT/ship-traffic-tracker
- **Data:** Live ship traffic map for the Strait of Hormuz.
- **Also:** https://hormuzstraitmonitor.com/ - Real-time ship transit counts, oil prices, stranded vessels, insurance premiums, updated hourly.

---

## 4. Dark Fleet & Sanctions Tracking

### FleetLeaks (Recommended - Free, No Registration)
- **URL:** https://fleetleaks.com
- **Data:** 883 sanctioned vessels across US (OFAC), EU, UK, Canada, Australia, NZ. Daily sync from official sources. Live AIS tracking, flag-hopping detection, AIS gap detection, STS candidate identification.
- **Features:** Vessel map (https://fleetleaks.com/vessel-map/), AIS events scoring, satellite corroboration, Russian oil terminal database.
- **Programmatic:** Web-based. No documented API but data is structured.
- **Currency:** Daily sanctions sync, real-time AIS.

### darkfleet.app
- **URL:** https://darkfleet.app
- **Data:** Sanctioned vessel tracking. 1,481 active dark fleet vessels. Maps based on satellite imagery (not just AIS). STS transfer locations.
- **Related to:** TankerTrackers.com
- **Programmatic:** Partial. Some features require corporate subscription.

### TankerTrackers.com
- **URL:** https://tankertrackers.com
- **Data:** Crude oil shipment tracking via daily satellite imagery, shore photography, and AIS. Covers Kharg Island (Iran), Russian terminals. Dark fleet stats: https://tankertrackers.com/report/darkfleetinfo
- **Sanctions list:** https://tankertrackers.com/report/sanctioned
- **Programmatic:** Paid corporate subscriptions for API-level access.
- **Currency:** Daily satellite updates.

### UANI Iran Tanker Tracker
- **URL:** https://www.unitedagainstnucleariran.com/tanker-tracker
- **Data:** Monthly reports on Iranian oil shipments. Ghost Armada database of 560+ vessels involved in Iranian oil smuggling. International sanctions database.
- **Programmatic:** No API. Reports are web/PDF.
- **Currency:** Monthly reports.

### C4ADS - Oil and Water Report
- **URL:** https://c4ads.org/reports/oil-and-water/
- **Data:** Investigative reports on maritime sanctions evasion using vessel ownership databases, corporate registries, satellite imagery, AIS, leaked data.
- **Programmatic:** No. Reports only.

---

## 5. Satellite Imagery for Ship Detection

### Copernicus Sentinel-1 SAR (Recommended - Free)
- **URL:** https://dataspace.copernicus.eu/data-collections/sentinel-data/sentinel-1
- **Data:** Free Synthetic Aperture Radar imagery. Detects vessels regardless of AIS status. Day/night, through clouds. Sentinel-1C launched Dec 2024 now includes onboard AIS antenna.
- **API:** Multiple. OData, S3, STAC, openEO, Sentinel Hub APIs. Free registration required.
  - Docs: https://documentation.dataspace.copernicus.eu/APIs.html
  - Python: https://github.com/sentinelsat/sentinelsat
  - Also: https://github.com/armkhudinyan/copernicus_api
- **Programmatic:** Yes. Full programmatic download and processing.
- **Revisit:** ~6 days (with 1C+1D constellation).

### SARfish (Open Source Ship Detection)
- **URL:** https://github.com/MJCruickshank/SARfish
- **Data:** Ship detection in Sentinel-1 SAR imagery. Outputs GeoJSON with detection confidence and onshore filtering.
- **Dependencies:** GDAL, PyTorch, rasterio, etc.
- **Programmatic:** Yes, Python CLI tool.

### SAR-SHIP-DETECTION (YOLOv8 + DeepSort)
- **URL:** https://github.com/ioEclipse/SAR-SHIP-DETECTION
- **Data:** End-to-end ship detection and tracking in SAR imagery using YOLOv8 and DeepSort on Sentinel-1 data. Designed for edge computing (Jetson Nano).
- **Programmatic:** Yes.

### Allen AI SAR Vessel Detection (xView3)
- **URL:** https://github.com/allenai/sar_vessel_detect
- **Data:** Sentinel-1 vessel detection model from the xView3 challenge. High accuracy.
- **Programmatic:** Yes, Python.

### SUMO (EU JRC)
- **Data:** Search for Unidentified Maritime Objects. Open-source software from EU Joint Research Centre. 15+ years of development. Compatible with multiple SAR satellites including Sentinel-1.
- **Programmatic:** Yes, standalone application.

### Bellingcat RS4OSINT
- **URL:** https://bellingcat.github.io/RS4OSINT/C5_Object_Detection.html
- **Data:** Tutorial and tools for object detection in remote sensing imagery for OSINT, including ship detection.

### SAR Ship Detection Datasets
- **LS-SSDD-v1.0:** https://github.com/TianwenZhang0825/LS-SSDD-v1.0-OPEN (9,000 sub-images from Sentinel-1)
- **OpenSARShip:** 34,528 SAR ship chips with AIS labels (https://opensar.sjtu.edu.cn/project.html)
- **Comprehensive list:** https://github.com/jasonmanesis/Satellite-Imagery-Datasets-Containing-Ships

---

## 6. Commercial Maritime Intelligence Platforms (with APIs)

### Spire Maritime
- **URL:** https://spire.com/maritime/ | https://insights.spire.com/maritime/dark-shipping-detection
- **Data:** Satellite AIS (global, not just coastal). Dark shipping detection via Doppler Geolocation Validation. Spoofing detection.
- **API:** Yes, REST API (paid). Also web platform "Shipview".
- **Special:** Proprietary satellite constellation validates AIS positions using RF doppler shift. Can detect vessels reporting false positions.

### Windward Maritime AI
- **URL:** https://windward.ai
- **Data:** Behavioral AI models over AIS, SAR, EO satellite, RF signals. Anomaly detection, predictive intelligence. Daily "Iran War Maritime Intelligence" reports since March 2026.
- **API:** Enterprise. MIOC (Maritime Intelligence Operations Center) platform.
- **Hormuz-specific:** Daily intelligence reports: https://windward.ai/blog/ (March 2026 series)

### Global Fishing Watch (Recommended - Free API)
- **URL:** https://globalfishingwatch.org/our-apis/
- **Data:** AIS fishing effort, vessel presence, SAR vessel detections, encounters, loitering, port visits. Free for non-commercial use.
- **API:** Yes, free REST API. JSON responses.
  - Python: https://github.com/GlobalFishingWatch/gfw-api-python-client
  - R: https://github.com/GlobalFishingWatch/gfwr
  - Docs: https://globalfishingwatch.org/our-apis/documentation
- **Programmatic:** Yes. Excellent for detecting vessels in areas of interest including those without AIS.
- **Coverage:** Global. Includes SAR-based detections (catches dark vessels).

### Datalastic
- **URL:** https://datalastic.com
- **Data:** Historical and real-time AIS data. Vessel tracking API.
- **API:** Yes, paid.

### VT Explorer
- **URL:** https://www.vtexplorer.com
- **Data:** Real-time AIS positions via LiveData API. Terrestrial + satellite AIS for global coverage.
- **API:** Yes, paid.

---

## 7. Twitter/X OSINT Accounts for Naval Tracking

### Key Naval-Focused Accounts
| Account | Focus |
|-|-|
| @WarshipCam | Warship photography, ship identification. Large photo database cross-referenceable with vessel configs. |
| @NavyLookout | UK naval news, tracks Russian and NATO naval activity. Active OSINT commentary. |
| @Saturn5_ (Bosphorus Naval News) | Tracks all naval transits through the Bosphorus strait. Associated with turkishnavy.net. |
| @YorukIsik | Bosphorus-based spotter, photographs every warship transiting the strait. Primary source for Black Sea fleet movements. |
| @sentdefender (OSINT Defender) | Broad conflict OSINT including naval movements, geopolitical alerts. |
| @osinttechnical | Technical military OSINT including naval assets. |
| @TankerTrackers | Dark fleet and sanctions evasion tracking. Satellite imagery analysis. |
| @nosintel (NOSI) | Naval Open Source Intelligence aggregator. |

### Methods Used
- AIS data from MarineTraffic/VesselFinder cross-referenced with ship photos
- Webcam monitoring of straits, ports, and anchorages
- Community photo networks at key chokepoints (Bosphorus, Suez, Gibraltar, Hormuz)
- Satellite imagery analysis for port activity

---

## 8. Telegram Channels

Telegram is heavily used for real-time OSINT distribution but channels are ephemeral. Key patterns:
- **@OsintTv** - Foreign affairs, geopolitics, aviation/maritime
- Search TGStat (https://tgstat.com) for channels matching "naval OSINT", "warship", "maritime intelligence"
- Many naval OSINT accounts cross-post to Telegram from Twitter/X
- Conflict-specific channels emerge rapidly (e.g., Hormuz crisis channels since March 2026)

---

## 9. Investigative / Research Organizations

### Bellingcat
- **Toolkit:** https://bellingcat.gitbook.io/toolkit (includes MarineTraffic, maritime investigation guides)
- **RS4OSINT:** https://bellingcat.github.io/RS4OSINT/ (remote sensing for OSINT, ship detection)
- **Challenges:** Maritime-focused OSINT challenges teach methodology (Strait Through, Frozen Assets, etc.)
- **Key identifiers:** IMO numbers (permanent, 7-digit), MMSI numbers (9-digit, flag-issued)

### NOSI (Naval Open Source Intelligence)
- **URL:** https://nosi.org
- **Twitter:** @nosintel
- **Data:** Curated naval news from open sources since 2000. Covers global naval operations, exercises, deployments.
- **Programmatic:** RSS feed at https://nosi.org/feed/

### Pulitzer Center
- **Guide:** https://pulitzercenter.org/resource/how-track-ships-pro-using-osint-part-i
- **Data:** Methodology guide for ship tracking using OSINT tools.

### Follow the Money
- **URL:** https://github.com/followthemoney/vessel_research
- **Data:** Code for investigating vessels. Used in sanctions evasion journalism.

---

## 10. GitHub Repositories & Tools

### Curated Lists
| Repo | Description |
|-|-|
| [atlas-bear/osint-tools](https://github.com/atlas-bear/osint-tools) | Maritime and supply chain OSINT tools for intelligence practitioners |
| [The-Osint-Toolbox/Flight-And-Marine-OSINT](https://github.com/The-Osint-Toolbox/Flight-And-Marine-OSINT) | Flight and marine OSINT resource collection |
| [jivoi/awesome-osint](https://github.com/jivoi/awesome-osint) | Comprehensive OSINT list including maritime section |
| [github.com/topics/maritime-osint](https://github.com/topics/maritime-osint) | GitHub topic page for maritime OSINT projects |
| [github.com/topics/maritime-intelligence](https://github.com/topics/maritime-intelligence) | GitHub topic page for maritime intelligence |

### Active Tools
| Repo | Description |
|-|-|
| [cloudweaver/clawdwatch](https://github.com/cloudweaver/clawdwatch) | Real-time OSINT agent. Ship tracking with AIS API, dark ship detection, military vessel alerts, tanker tracking. Monitors Hormuz, Bandar Abbas, Bushehr. Node.js. |
| [aisstream/aisstream](https://github.com/aisstream) | Official aisstream.io WebSocket client examples |
| [dma-ais/AisTrack](https://github.com/dma-ais/AisTrack) | Live AIS vessel target monitoring from multiple data streams |
| [McOrts/AIS-ship-tracking-receiver](https://github.com/McOrts/AIS-ship-tracking-receiver) | DIY AIS receiver for marine traffic monitoring |
| [followthemoney/vessel_research](https://github.com/followthemoney/vessel_research) | Vessel investigation code (sanctions/journalism) |
| [sentinelsat/sentinelsat](https://github.com/sentinelsat/sentinelsat) | Search and download Copernicus Sentinel satellite images |
| [MJCruickshank/SARfish](https://github.com/MJCruickshank/SARfish) | Ship detection in Sentinel-1 SAR imagery |
| [allenai/sar_vessel_detect](https://github.com/allenai/sar_vessel_detect) | Sentinel-1 vessel detection (xView3 challenge winner) |
| [ioEclipse/SAR-SHIP-DETECTION](https://github.com/ioEclipse/SAR-SHIP-DETECTION) | YOLOv8 + DeepSort ship detection/tracking on Sentinel-1 |

---

## 11. Recommended Stack for Hormuz Tracker

For a project tracking military/naval vessels in the Strait of Hormuz, the most actionable combination:

**Real-time AIS (free):**
1. **aisstream.io** WebSocket API - filter by Hormuz bounding box (~26.0-27.0N, 55.5-57.0E)
2. Cross-reference MMSI numbers against known military vessel databases

**Dark vessel detection (free):**
3. **Sentinel-1 SAR** via Copernicus API - detect vessels with AIS off
4. **SARfish** or **allenai/sar_vessel_detect** for automated detection
5. **Global Fishing Watch API** - SAR vessel detections layer (free, non-commercial)

**Sanctions/dark fleet context (free):**
6. **FleetLeaks** - sanctioned vessel database with live AIS
7. **UANI Ghost Armada** list for Iranian-linked vessels

**Social/community OSINT:**
8. Monitor @YorukIsik, @NavyLookout, @TankerTrackers, @WarshipCam on X
9. **Windward daily intelligence reports** for Hormuz-specific analysis

**All-in-one tool:**
10. **clawdwatch** - already configured for Hormuz region, integrates AIS + satellite + social media

---

## Key Limitation

Military warships frequently operate with AIS transponders disabled. In the current Hormuz crisis, GPS jamming and AIS spoofing are widespread (1,650+ affected vessels, 44 injected signal zones, 92 denial areas detected as of March 2026). SAR satellite imagery is the most reliable method for detecting vessels operating dark, but has limited temporal resolution (~6 day revisit for Sentinel-1).
