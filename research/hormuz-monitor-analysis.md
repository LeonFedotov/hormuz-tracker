# Research Report: hormuzstraitmonitor.com Analysis
Generated: 2026-03-10

## Summary

Hormuz Strait Monitor is a Next.js 15 (App Router + Turbopack) dashboard that tracks the Strait of Hormuz shipping crisis. It uses a client-side React app with TanStack Query polling a single `/api/dashboard` endpoint every 60 seconds. The dashboard has hardcoded fallback data baked into the JS bundle, making the entire data model extractable. There are no public APIs to consume, but the data model and design system are well worth studying.

## Questions Answered

### Q1: What data sources do they use?

**Answer:** Four sources listed on their About page, but the specifics are vague:

1. **Maritime Intelligence** -- described as "AI-powered analysis of current strait conditions, insurance markets, and diplomatic developments using real-time web data." This is almost certainly an LLM (likely GPT or Claude) summarizing scraped/aggregated web content on each refresh cycle.
2. **Energy Market Feeds** -- "Live Brent crude oil pricing from financial data providers." No specific provider named. Could be Yahoo Finance, Alpha Vantage, or a commercial feed.
3. **AIS Vessel Tracking** -- "Automatic Identification System data for real-time vessel positions." They have Leaflet map integration in their CSS (`.leaflet-container`, `.vessel-popup-*` classes), suggesting they render AIS positions on a map. Likely sourced from MarineTraffic, VesselFinder, or Spire Maritime APIs.
4. **News Aggregation** -- "Curated news from major international outlets." The fallback data references Reuters, Lloyd's List, Financial Times, Al Jazeera, and Bloomberg. Likely scraped or API-driven from Google News / NewsAPI / similar.

**Confidence:** Medium -- data sources are self-described, actual providers not confirmed.

### Q2: What features do they have?

**Answer:** The dashboard provides 8 distinct widgets plus supporting pages:

| Widget | Data Fields | Notes |
|-|-|-|
| Strait Status | status (OPEN/RESTRICTED/CLOSED), since date, description | Hero banner, full-width |
| Ship Transits | currentTransits, last24h, normalDaily, percentOfNormal | Shows vs-normal comparison |
| Brent Crude Oil | brentPrice, change24h, changePercent24h, sparkline (24 data points) | SVG sparkline chart |
| Stranded Vessels | total, tankers, bulk, other, changeToday | Breakdown bars by type |
| War Risk Insurance | level (NORMAL/ELEVATED/EXTREME), warRiskPercent, normalPercent, multiplier | Color-coded severity |
| Daily Throughput (DWT) | todayDWT, averageDWT, percentOfNormal, last7Days (7 data points) | Bar chart, 7-day history |
| Diplomacy / Peace Talks | status, headline, date, parties[], summary | Text-based status card |
| News Feed | title, source, url, publishedAt, description (5 articles) | List with source attribution |

**Additional pages:**
- `/news` -- News Archive with historical coverage (SSR skeleton + client hydration)
- `/faq` -- FAQ page (uses schema.org FAQPage structured data, dynamically generated from live data)
- `/about` -- Static content about the project

**Confidence:** High -- extracted directly from the JS bundle.

### Q3: Do they expose any APIs or data endpoints we could use?

**Answer:** No publicly accessible APIs. All tested paths returned 404:

- `/api/status` -- 404
- `/api/data` -- 404
- `/api/metrics` -- 404
- `/api/news` -- 404
- `/api/strait` -- 404
- `/api/vessels` -- 404
- `/api/dashboard` -- 404 (from outside; only accessible server-side or via auth)

The client JS calls `tO.get("/api/dashboard")` via an Axios instance (`baseURL: ""`, meaning same-origin), but this endpoint is not publicly exposed -- it's likely a Next.js API route that requires being called from the deployed domain or has some access control. The important finding is that the **entire fallback dataset is embedded in the client JS bundle** as a catch block, so the data model is fully documented (see Q2 table).

**Confidence:** High -- directly probed all likely endpoints.

### Q4: What's their tech stack?

**Answer:**

| Layer | Technology |
|-|-|
| Framework | **Next.js 15** (App Router, React Server Components) |
| Bundler | **Turbopack** (`turbopack-*.js` chunks in source) |
| Styling | **Tailwind CSS v4** (new `@layer theme`, `@property` directives, `color-mix()` support) |
| Fonts | **Inter** (sans) + **JetBrains Mono** (mono) |
| HTTP Client | **Axios** (bundled, `tO = tN.create({baseURL: "", timeout: 10000})`) |
| Data Fetching | **TanStack Query** (React Query) -- `queryKey: ["dashboard"]`, `refetchInterval: 60000`, `staleTime: 30000`, `retry: 3` |
| Maps | **Leaflet** (CSS includes `.leaflet-container`, `.leaflet-popup-*`, `.leaflet-control-zoom` styles) |
| Ads | **Google AdSense** (`ca-pub-7976785260330408`) |
| SEO | Schema.org JSON-LD (WebApplication + FAQPage), OG tags, Twitter cards, XML sitemap |
| Deployment | Likely **Vercel** (Next.js conventions, `_next/static/chunks/` structure) |

**Confidence:** High -- extracted from page source and JS bundles.

### Q5: Interesting UI/UX patterns worth copying?

**Answer:**

#### Design System ("ops" theme)
Dark military/operations aesthetic with a custom color palette:
```css
--color-ops-bg:     #0a0f1a   /* near-black navy */
--color-ops-surface: #111827   /* dark card bg */
--color-ops-border:  #1e2a3a   /* subtle borders */
--color-ops-green:   #00ff88   /* neon green -- good/open */
--color-ops-amber:   #ffb800   /* amber -- warning/prices */
--color-ops-red:     #ff3344   /* red -- danger/closed */
--color-ops-blue:    #3b82f6   /* blue -- info */
--color-ops-text:    #f1f5f9   /* light text */
--color-ops-muted:   #94a3b8   /* secondary text */
```

#### Widget Card Pattern
```css
.widget-card {
  background-color: var(--color-ops-surface);
  border: 1px solid var(--color-ops-border);
  border-radius: .75rem;
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
}
```

#### Key UX Patterns
1. **Skeleton loading** -- Server renders `animate-pulse` placeholder divs matching the exact grid layout. Zero layout shift.
2. **Noscript fallback** -- Full article with key metrics in a `<noscript>` tag for SEO and accessibility.
3. **Glow effects** -- Status-dependent box shadows (`.glow-green`, `.glow-red`, `.glow-amber`) for visual urgency.
4. **Scanline overlay** -- `.scanline:after` applies a repeating-gradient CRT effect for the military aesthetic.
5. **Blinking indicator** -- `animate-blink` (1.5s step-end infinite) for live status dots.
6. **Sticky header** with `backdrop-blur-sm` for glass-morphism effect.
7. **Mono typography** for all data values (JetBrains Mono), sans-serif for headings (Inter).
8. **Status badge component** -- Pill-shaped, color-coded by severity level:
   - NORMAL: green bg/border/text
   - ELEVATED: amber bg/border/text
   - EXTREME: red bg/border/text
9. **Sparkline charts** -- Inline SVG sparklines for oil price (24 data points).
10. **Bar charts** -- CSS-only bar charts for 7-day throughput history.
11. **Schema.org FAQPage** -- Dynamically generates FAQ structured data from live metrics (e.g., "Is the Strait of Hormuz open?" answer includes current ship counts).
12. **Google Ads placement** -- Three horizontal ad slots interspersed between widget rows.
13. **Leaflet map** -- Styled to match the dark ops theme (custom popup styles, dark tile layer).
14. **Error state** -- "CONNECTION LOST" with auto-retry messaging when API fails.

#### Data Polling Strategy
- TanStack Query with `refetchInterval: 60000` (1 min)
- `staleTime: 30000` (30 sec)
- `retry: 3` on failure
- `refetchOnWindowFocus: true`
- Graceful degradation: catch block returns full hardcoded dataset

## Competitor: hormuztracker.com

Also exists at `www.hormuztracker.com` ("Hormuz Crisis Dashboard -- Real-Time Shipping Disruption Tracker"). Claims continuous updates vs hourly. Both are free. The Monitor site has more detailed analytics (insurance, throughput DWT, diplomacy tracking).

## Recommendations

### For This Codebase

1. **Adopt the data model** -- The 8-widget structure (status, transits, oil, stranded, insurance, throughput, diplomacy, news) is a solid baseline. Our `ships_strait.json` covers vessel positions but we're missing oil prices, insurance, diplomacy, and news.

2. **Use the color palette** -- The ops theme is effective and professional. Consider adopting or adapting the same color tokens for our `index.html`.

3. **Add sparklines** -- The 24-point sparkline for oil prices and 7-day bar chart for throughput are compact and informative. These can be done with inline SVG.

4. **Consider polling** -- They poll every 60s with TanStack Query. If we add a backend, this is a good refresh cadence. If we stay static, consider a build-time data fetch + deploy pipeline.

5. **SEO with noscript** -- Their noscript approach with full text content is smart for a JS-heavy dashboard. We could do the same.

6. **No APIs to scrape** -- The `/api/dashboard` endpoint is not publicly accessible. We need our own data pipeline (AIS data from MarineTraffic/Spire, oil prices from a financial API, etc.).

7. **Leaflet map styling** -- Their dark-themed Leaflet customization is clean. We already use a map; adopting their popup and control styling would improve consistency.

### Data Sources to Investigate

Since their APIs are not public, we need our own feeds:

| Data Type | Potential Sources |
|-|-|
| AIS vessel positions | MarineTraffic API, VesselFinder, Spire Maritime, AISHub (free) |
| Oil prices | Yahoo Finance API, Alpha Vantage, EIA API (free) |
| War risk insurance | Lloyd's Market Association (manual), Concirrus (commercial) |
| News | Google News RSS, NewsAPI.org, MediaStack |
| Diplomacy/status | Manual curation or LLM summarization of news feeds |

## Sources

1. [Hormuz Strait Monitor -- Main Page](https://hormuzstraitmonitor.com/) -- Primary analysis target
2. [About -- Hormuz Strait Monitor](https://hormuzstraitmonitor.com/about) -- Data source descriptions
3. [Hormuz Strait Monitor sitemap.xml](https://hormuzstraitmonitor.com/sitemap.xml) -- Site structure (4 pages, hourly updates)
4. [Hormuz Tracker (competitor)](https://www.hormuztracker.com/) -- Alternative dashboard for comparison
5. [2026 Strait of Hormuz crisis -- Wikipedia](https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis) -- Crisis context

## Appendix: Full Fallback Data Model

Extracted from the client JS bundle (`65a103423df353a8.js`), this is the complete data shape returned by `/api/dashboard`:

```json
{
  "success": true,
  "data": {
    "straitStatus": {
      "status": "CLOSED",
      "since": "2026-02-28T00:00:00Z",
      "description": "string"
    },
    "shipCount": {
      "currentTransits": 0,
      "last24h": 2,
      "normalDaily": 60,
      "percentOfNormal": 3.3
    },
    "oilPrice": {
      "brentPrice": 91.47,
      "change24h": 3.82,
      "changePercent24h": 4.36,
      "sparkline": [/* 24 float values */]
    },
    "strandedVessels": {
      "total": 157,
      "tankers": 98,
      "bulk": 34,
      "other": 25,
      "changeToday": 12
    },
    "insurance": {
      "level": "EXTREME",
      "warRiskPercent": 2.5,
      "normalPercent": 0.15,
      "multiplier": 16.7
    },
    "throughput": {
      "todayDWT": 180000,
      "averageDWT": 10300000,
      "percentOfNormal": 1.7,
      "last7Days": [10100000, 9800000, 5200000, 2100000, 800000, 350000, 180000]
    },
    "diplomacy": {
      "status": "NO_TALKS",
      "headline": "string",
      "date": "2026-03-05T00:00:00Z",
      "parties": ["Iran", "United States", "GCC"],
      "summary": "string"
    },
    "news": [
      {
        "title": "string",
        "source": "Reuters",
        "url": "https://reuters.com",
        "publishedAt": "2026-03-05T08:00:00Z",
        "description": "string"
      }
    ],
    "lastUpdated": "ISO8601"
  },
  "timestamp": "ISO8601"
}
```
