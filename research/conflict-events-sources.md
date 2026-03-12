# Research Report: Conflict Event Data Sources for 2026 Strait of Hormuz Crisis
Generated: 2026-03-10

## Summary

The 2026 Strait of Hormuz crisis (beginning Feb 28) has spawned numerous OSINT tracking
platforms. The best programmatic source is **iranwarlive.com/feed.json** -- a clean JSON feed
with event types, coordinates, timestamps, and source URLs, freely accessible with no auth.
**ACLED** provides the gold-standard structured conflict dataset (CSV/JSON with lat/lon) but
requires a free account. **LiveUAMap** has data but locks it behind a paid API. Reddit's
r/CredibleDefense runs daily megathreads accessible via the unauthenticated JSON API.

---

## 1. LiveUAMap (iran.liveuamap.com)

### Data Format & API
- **Frontend URL:** https://iran.liveuamap.com
- **Internal AJAX endpoints** found in JS bundle (`allo-*.js`):
  - `ajax/do?act=timeline` -- timeline events
  - `ajax/do?act=prevday&id=<id>` -- historical pagination
  - `ajax/do?act=a<obfuscated>&curid=<id>&time=<ts>&last=<id>` -- live polling
- **Tile provider:** Mapbox satellite-streets-v9
- **Returns:** HTML fragments, not structured JSON. Requires session cookies + obfuscated params.
- **Official API:** Paid, at https://liveuamap.com/promo/api (also https://iran.liveuamap.com/promo/api)
  - Supports KML/GeoJSON export
  - No public pricing visible; contact required
- **PRO export:** KML/GeoJSON data export available with paid PRO subscription

### Event Types Tracked
- Air strikes (US, Israeli)
- Missile launches and interceptions
- Naval engagements
- Infrastructure damage
- Drone strikes
- Explosions / incidents
- Each event has: headline, timestamp, lat/lon marker on map, source link

### Scraping Feasibility
- **Difficulty: HIGH.** AJAX endpoints require cookies and use obfuscated function names.
  Responses are HTML fragments, not JSON. Rate-limited behind Cloudflare.
- **Alternative:** The GitHub project [conflict-investigations/liveuamap-analysis](https://github.com/conflict-investigations/liveuamap-analysis)
  has a Python scraper with GH Actions automation, outputting JSON. Worth forking/adapting.
- **Recommendation:** Use iranwarlive.com or ACLED instead for structured data. Only use
  liveuamap for manual cross-reference or if paying for their API.

---

## 2. IranWarLive.com (BEST FREE STRUCTURED SOURCE)

### Data Format & API
- **Feed URL:** `GET https://iranwarlive.com/feed.json`
- **Format:** JSON Feed v2.0
- **Auth required:** None
- **Update frequency:** Continuous (checked: last_updated was within minutes of request)
- **Additional endpoints:**
  - `/casualties.html` -- casualty tracking
  - `/airspace.html` -- NOTAM/airspace closures
  - `/llms.txt` -- machine-readable site description

### Event Schema
```json
{
  "event_id": "IRW-V4-1773163910853-0",
  "type": "Air strike",
  "location": "Central Beirut, Lebanon",
  "timestamp": "2026-03-10T17:31:03.315Z",
  "confidence": "OSINT",
  "event_summary": "On 2026-03-10, a Air strike targeted Meeting of Quds Force operatives...",
  "source_url": "https://www.bbc.com/news/articles/...",
  "_osint_meta": {
    "casualties": 0,
    "coordinates": {
      "lat": 33.89,
      "lng": 35.5
    }
  }
}
```

### Event Types Observed (from live feed)
- Air strike
- Air attacks (Israel-US)
- US-Israeli strikes
- Interception of retaliatory strikes
- Strike (general)
- Reported Israeli strike

### Methodology
- Sources: Reuters, AP, Al Jazeera, CENTCOM, official state defense wires
- "Circuit Breaker" algorithm deduplicates historical recaps vs. new kinetic events
- Macro-casualty figures are human-verified against Tier-1 defense sources
- Politically agnostic Subject/Object extraction

### Programmatic Access: CONFIRMED WORKING
```bash
curl -sfS "https://iranwarlive.com/feed.json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data['items']:
    c = item['_osint_meta']['coordinates']
    print(f\"{item['type']:30s} | {c['lat']:7.2f}, {c['lng']:7.2f} | {item['location']}\")
"
```

---

## 3. ACLED (Armed Conflict Location & Event Data)

### Data Format & API
- **Iran crisis page:** https://acleddata.com/iran-crisis-live
- **Daily data file:** https://acleddata.com/curated/data-us-iran-regional-conflict-daily
  - Updated daily at 3:30 PM CET / 9:00 AM EST
- **API endpoint:** `https://acleddata.com/api/acled/read`
  - Formats: CSV, JSON, XML, TXT
  - Example: `?_format=csv&country=Iran&year=2026`
  - Field selection: `&fields=latitude|longitude|event_type|event_date|notes`
- **Auth:** Free myACLED account required (email + API key)
- **HDX mirror:** https://data.humdata.org/dataset/iran-acled-conflict-data (weekly updates)

### Data Columns (key fields)
- `event_id_cnty`, `event_date`, `event_type`, `sub_event_type`
- `actor1`, `actor2`, `interaction`
- `latitude`, `longitude`, `geo_precision`
- `source`, `notes`, `fatalities`

### Event Types
- Battles, Explosions/Remote violence, Violence against civilians
- Strategic developments, Protests, Riots

### Programmatic Access
```python
import requests
url = "https://acleddata.com/api/acled/read"
params = {
    "key": "YOUR_API_KEY",
    "email": "YOUR_EMAIL",
    "_format": "json",
    "country": "Iran",
    "event_date": "2026-02-28|2026-03-10",
    "event_date_where": "BETWEEN",
}
response = requests.get(url, params=params)
events = response.json()["data"]
```

---

## 4. Reddit Sources

### Subreddits Tracking the Crisis

| Subreddit | Content | Frequency |
|-|-|-|
| r/CredibleDefense | Daily "Active Conflicts & News Megathread" with expert military analysis | Daily megathread |
| r/OSINT | OSINT methods, satellite imagery analysis (Sentinel-1 InSAR), tool recommendations | Irregular, high quality |
| r/geopolitics | Strategic/geopolitical analysis threads | Multiple daily |
| r/CombatFootage | Combat videos, strike footage from Gulf region | Multiple daily |

### API Access (No Auth Required)
```
GET https://old.reddit.com/r/{subreddit}/search.json?q={query}&restrict_sr=on&sort=new&limit=100
```
- Set `User-Agent` header to avoid 429 rate limits
- Returns JSON with post title, score, comment count, URL, created_utc
- **Rate limit:** ~60 requests/minute without OAuth

### Confirmed Working Endpoints
```bash
# CredibleDefense daily megathreads
curl -sfS -H "User-Agent: hormuz-tracker/0.1" \
  "https://old.reddit.com/r/CredibleDefense/search.json?q=megathread+iran+OR+hormuz&restrict_sr=on&sort=new&limit=10"

# OSINT Iran satellite analysis
curl -sfS -H "User-Agent: hormuz-tracker/0.1" \
  "https://old.reddit.com/r/OSINT/search.json?q=iran+hormuz+strait&restrict_sr=on&sort=new&limit=10"
```

### Key Threads Found
- r/CredibleDefense: "Active Conflicts & News Megathread March 10, 2026" (daily, 30+ pts)
- r/CredibleDefense: "Israel-Iran Conflict Megathread" (pinned, comprehensive)
- r/OSINT: "Kharg Island probably got wrecked" (235 pts) -- satellite imagery
- r/OSINT: Sentinel-1 InSAR analysis of Persian Gulf military bases (236 pts)

---

## 5. Additional Structured Sources

### Windward.ai Maritime Intelligence
- **URL:** https://windward.ai/blog/ (daily maritime intelligence reports)
- **Data:** AIS tracking, vessel counts through Hormuz, GPS jamming zones
- **Format:** Blog posts with embedded data (not a public API)
- **Key metric:** Daily transit counts (e.g., "3 commercial transits on March 7", "single outbound Iranian-flagged vessel on March 9")
- **Programmatic access:** No public API. Data extractable via scraping blog posts.

### INSS Lion's Roar Dashboard
- **URL:** https://www.inss.org.il/publication/lions-roar-data/
- **Interactive map:** https://www.inss.org.il/publication/lions-roar-map/
- **Data:** Israeli/US strikes, Iranian retaliatory strikes, US force deployments, Iranian military facilities
- **Format:** Interactive web dashboard (likely ArcGIS/Mapbox). No public data download found.
- **Update frequency:** Continuous, based on OSINT and media reports

### Iran Monitor (iranmonitor.org)
- **URL:** https://www.iranmonitor.org/
- **Data:** News sentiment, X/Twitter feeds, flight radar, prediction markets, internet connectivity
- **Format:** Web dashboard. No documented API.
- **Limitations:** Western/opposition source bias noted

### Other Live Maps
| Platform | URL | Data | API |
|-|-|-|-|
| IranWarMap | https://iranwarmap.com/ | AI-powered conflict monitor | Unknown |
| Iran Strike Map | https://iranstrikemap.com/ | US-Israel strike locations | Updated every 30 min, no public API |
| Live Iran Map | https://live-iran-map.com/map | Airstrike & missile tracker | No public API |
| StrikeMap.live | https://strikemap.live/ | US/Israel Iran tracker | Unknown |
| Global Conflict Awareness | https://globalconflictawareness.com/ | OSINT map aggregator | Unknown |
| Hormuz Strait Monitor | https://hormuzstraitmonitor.com/ | Shipping, oil prices, insurance | Updated hourly, no public API found |
| Hormuz Tracker | https://www.hormuztracker.com/ | Shipping disruption dashboard | Unknown |
| ArcGIS StoryMap | https://storymaps.arcgis.com/stories/089bc1a2fe684405a67d67f13bd31324 | Interactive strike map | ArcGIS REST API possible |

### GitHub OSINT Data Repository
- **URL:** https://github.com/danielrosehill/Iran-Israel-War-2026-OSINT-Data
- **Data:** 75+ fields per military operation wave -- timing, weapons, targets, interception, escalation
- **Coverage:** Israel, Kuwait, Bahrain, UAE, Qatar, Saudi Arabia, Iraq, Oman, Cyprus, Jordan, Turkey, Diego Garcia
- **Format:** Structured data files with date-stamped reports (DDMM format)
- **Update:** Ongoing, community-maintained

### Critical Threats Project (AEI/ISW)
- **URL:** https://www.criticalthreats.org/analysis/ (search "iran update")
- **Data:** Twice-daily analysis reports (morning: US/Israeli strikes; evening: 24hr roundup)
- **Format:** Long-form web articles with detailed event listings. No structured API.
- **Quality:** Very high analytical quality but requires NLP/scraping to extract events.

---

## 6. Conflict Event Timeline (Key Hormuz-Area Events)

### Feb 28, 2026 -- Day 1
- US-Israel joint strikes begin ("Operation Epic Fury" / "Lion's Roar")
- Iran Supreme Leader Khamenei killed
- Iran retaliates with missiles/drones on US bases, Israel, Gulf states
- At least 3 tankers struck near Strait of Hormuz
- Outgoing Hormuz traffic heavy, incoming light; 17+ tankers still transiting

### Mar 1, 2026 -- Day 2
- **MKD Vyom** (Marshall Islands-flagged crude tanker) struck by projectile off Muscat, Oman -- 1 crew killed
- **Stena Imperative** (US-flagged product tanker) struck by projectiles at port of Bahrain -- fire, 1 port worker killed
- Oil tanker near Hormuz set ablaze (black smoke visible, Al Jazeera footage)
- 7 of 12 International Group P&I Clubs cancel war risk coverage
- Maersk, CMA CGM, Hapag-Lloyd suspend Hormuz transits
- Traffic drops ~70%; 150+ ships anchor outside strait

### Mar 2, 2026 -- Day 3
- IRGC officially declares Strait of Hormuz closed
- **Athe Nova** (Honduras-flagged oil tanker) hit by 2 drones in Hormuz, set ablaze
- **Sonangol Namibe** (oil tanker) -- explosion at Mubarak Al Kabeer Port, Kuwait; oil spill
- **Safeen Prestige** (Malta-flagged) struck, crew evacuated
- Zero commercial transits recorded

### Mar 3-4, 2026
- US Navy Operation Epic Fury strikes Iranian Navy at Bandar Abbas and Chah Bahar
- Oil tankers struck at Bandar Abbas by US Navy
- Kharg Island's 7 jetties destroyed by B-2/Tomahawk strikes -- 1.8M bpd export capacity offline
- Bandar Abbas refinery (320K bpd) feedstock severed
- IRGC says Iran in "complete control" of Hormuz

### Mar 5, 2026
- IRGC narrows closure: Hormuz closed only to US, Israel, and Western allies
- Iran mine stockpile (est. 5,000-6,000) reported being deployed
- GPS jamming affects 1,100+ ships in Middle East Gulf

### Mar 6, 2026
- Tugboat dispatched to assist Safeen Prestige struck by 2 missiles, sinks -- 3 crew missing

### Mar 7, 2026
- IRGC claims drone strike on oil tanker **Prima** in Persian Gulf
- IRGC claims drone strike on US oil tanker **Louise P** in Strait of Hormuz
- Iranian kamikaze drone boat makes first successful strike of war
- Only 3 commercial transits recorded by Windward.ai AIS tracking
- Brent crude surpasses $100/barrel

### Mar 8-9, 2026
- Mojtaba Khamenei named new Supreme Leader
- 7th US service member dies in conflict
- Israel bombs Tehran oil depots
- GPS jamming surges to 1,650 ships affected
- AIS disruption: 44 injected signal zones, 92 denial areas
- Single outbound Iranian-flagged vessel; no inbound movements on Mar 9

### Mar 10, 2026 (today)
- Iran Foreign Ministry warns tankers must be "very careful"
- Strait remains closed to most non-Iran-linked ships
- Brent crude at ~$126/barrel peak
- 750+ ships caught in backups

---

## 7. Recommendations for This Project

### Primary Data Ingestion (implement first)
1. **iranwarlive.com/feed.json** -- Poll every 5-15 min. Parse event_id, type, coordinates, timestamp.
   Filter for Hormuz-area events by bounding box (~24-28N, 50-58E).
2. **ACLED daily CSV** -- Download daily. Richest structured dataset with standardized event taxonomy.
   Requires free account signup.

### Secondary Sources (scrape or monitor)
3. **Reddit r/CredibleDefense megathreads** -- Poll daily via JSON API for breaking reports.
4. **danielrosehill/Iran-Israel-War-2026-OSINT-Data** on GitHub -- Clone/pull for historical reference data.
5. **Wikipedia 2026 Strait of Hormuz crisis** -- Scrape timeline table for structured event list.

### Manual Cross-Reference
6. **Critical Threats** twice-daily reports for analytical depth.
7. **Windward.ai** blog for maritime transit counts and AIS data.
8. **INSS dashboard** for interactive strike maps.

### Not Recommended
- LiveUAMap paid API (expensive, when free alternatives exist)
- Scraping liveuamap AJAX (fragile, obfuscated, Cloudflare-protected)
- Any source without coordinates (can't map without lat/lon)

---

## Sources

1. [IranWarLive.com](https://iranwarlive.com/) -- Real-time OSINT threat map with JSON feed
2. [ACLED Iran Crisis Live](https://acleddata.com/iran-crisis-live) -- Structured conflict event data
3. [Wikipedia: 2026 Strait of Hormuz crisis](https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis) -- Comprehensive timeline
4. [LiveUAMap Iran](https://iran.liveuamap.com/) -- Interactive conflict map
5. [LiveUAMap API](https://liveuamap.com/promo/api) -- Paid API access
6. [conflict-investigations/liveuamap-analysis](https://github.com/conflict-investigations/liveuamap-analysis) -- Python scraper for liveuamap
7. [danielrosehill/Iran-Israel-War-2026-OSINT-Data](https://github.com/danielrosehill/Iran-Israel-War-2026-OSINT-Data) -- Open OSINT dataset
8. [ACLED API Documentation](https://acleddata.com/acled-api-documentation) -- API reference
9. [Al Jazeera: Strait of Hormuz & oil markets](https://www.aljazeera.com/news/2026/3/1/how-us-israel-attacks-on-iran-threaten-the-strait-of-hormuz-oil-markets) -- Event reporting
10. [CNBC: Iran war tanker warning](https://www.cnbc.com/2026/03/09/iran-war-oil-tankers-strait-of-hormuz.html) -- Latest developments
11. [Marine Insight: Operation Epic Fury](https://www.marineinsight.com/shipping-news/u-s-strikes-iranian-navy-in-operation-epic-fury-warships-hit-at-bandar-abbas-and-chah-bahar/) -- Naval strikes
12. [Maritime Executive: Iranian Navy under attack](https://maritime-executive.com/article/iranian-navy-under-attack-in-operation-epic-fury) -- Naval operations
13. [Geopolitics Unplugged: Iran oil/gas infrastructure](https://geopoliticsunplugged.substack.com/p/irans-oil-and-gas-infrastructure) -- Infrastructure damage assessment
14. [Windward.ai Maritime Intelligence Daily](https://windward.ai/blog/march-10-maritime-intelligence-daily/) -- AIS/maritime tracking
15. [INSS Lion's Roar Dashboard](https://www.inss.org.il/publication/lions-roar-data/) -- Interactive strike map
16. [Iran Monitor](https://www.iranmonitor.org/) -- OSINT aggregation dashboard
17. [Critical Threats Iran Updates](https://www.criticalthreats.org/analysis/iran-update-evening-special-report-march-9-2026) -- Twice-daily analysis
18. [Erkan Saka: OSINT Sources](https://erkansaka.net/2026/02/28/osint-tools-us-israel-iran-conflict/) -- OSINT tool guide
19. [Hormuz Strait Monitor](https://hormuzstraitmonitor.com/) -- Shipping & oil crisis dashboard
20. [Iran Strike Map](https://iranstrikemap.com/) -- Airstrike location tracker
21. [Janes: Strait of Hormuz disruption](https://www.janes.com/osint-insights/defence-and-national-security-analysis/iran-conflict-2026-disruption-to-strait-of-hormuz-increases-energy-and-food-production-risks) -- Defence analysis
22. [Washington Institute: Demining Hormuz](https://www.washingtoninstitute.org/policy-analysis/political-military-challenges-demining-strait-hormuz) -- Mine warfare analysis
23. [Army Recognition: Iran layered defense](https://www.armyrecognition.com/news/army-news/2026/iran-builds-layered-missile-and-mine-shield-against-u-s-carriers-in-strait-of-hormuz) -- Mine/missile shield
