import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HORMUZ_BBOX,
  EVENT_TYPE_MAP,
  mapEventType,
  mapConfidence,
  isInBoundingBox,
  filterHormuzArea,
  parseIranWarLiveItem,
  normalizeEvent,
  deduplicateEvents,
  parseFeed,
  mapPicpathToType,
  mapColorToConfidence,
  normalizeVenue,
  parseVenuesResponse,
  extractSessionVars,
} from './liveuamap.js';

// ── Constants ─────────────────────────────────────────────────────

describe('HORMUZ_BBOX', () => {
  it('defines bounding box covering Strait of Hormuz region', () => {
    expect(HORMUZ_BBOX).toHaveProperty('minLat');
    expect(HORMUZ_BBOX).toHaveProperty('maxLat');
    expect(HORMUZ_BBOX).toHaveProperty('minLon');
    expect(HORMUZ_BBOX).toHaveProperty('maxLon');
    // Roughly 24-28N, 50-58E
    expect(HORMUZ_BBOX.minLat).toBeLessThanOrEqual(24);
    expect(HORMUZ_BBOX.maxLat).toBeGreaterThanOrEqual(28);
    expect(HORMUZ_BBOX.minLon).toBeLessThanOrEqual(50);
    expect(HORMUZ_BBOX.maxLon).toBeGreaterThanOrEqual(58);
  });
});

describe('EVENT_TYPE_MAP', () => {
  it('maps iranwarlive event types to our schema types', () => {
    // Keys are lowercase (mapEventType lowercases input before lookup)
    expect(EVENT_TYPE_MAP).toHaveProperty('air strike');
    expect(EVENT_TYPE_MAP).toHaveProperty('strike');
    expect(Object.values(EVENT_TYPE_MAP)).toContain('incident');
  });
});

// ── mapEventType ──────────────────────────────────────────────────

describe('mapEventType', () => {
  it('maps known types', () => {
    expect(mapEventType('Air strike')).toBe('incident');
    expect(mapEventType('Strike')).toBe('incident');
  });

  it('returns "incident" for unknown types', () => {
    expect(mapEventType('Unknown category xyz')).toBe('incident');
  });

  it('is case-insensitive', () => {
    expect(mapEventType('air strike')).toBe('incident');
    expect(mapEventType('AIR STRIKE')).toBe('incident');
  });
});

// ── mapConfidence ─────────────────────────────────────────────────

describe('mapConfidence', () => {
  it('maps OSINT to medium', () => {
    expect(mapConfidence('OSINT')).toBe('medium');
  });

  it('maps Confirmed to verified', () => {
    expect(mapConfidence('Confirmed')).toBe('verified');
  });

  it('returns "low" for unknown confidence levels', () => {
    expect(mapConfidence('random')).toBe('low');
  });

  it('is case-insensitive', () => {
    expect(mapConfidence('osint')).toBe('medium');
    expect(mapConfidence('CONFIRMED')).toBe('verified');
  });
});

// ── Bounding box filtering ────────────────────────────────────────

describe('isInBoundingBox', () => {
  it('returns true for point inside Hormuz area', () => {
    // Strait of Hormuz approx 26.5N, 56.3E
    expect(isInBoundingBox(26.5, 56.3, HORMUZ_BBOX)).toBe(true);
  });

  it('returns false for point outside Hormuz area', () => {
    // Beirut ~33.89N, 35.5E
    expect(isInBoundingBox(33.89, 35.5, HORMUZ_BBOX)).toBe(false);
  });

  it('returns false for null coordinates', () => {
    expect(isInBoundingBox(null, null, HORMUZ_BBOX)).toBe(false);
    expect(isInBoundingBox(26.5, null, HORMUZ_BBOX)).toBe(false);
  });

  it('includes boundary points', () => {
    expect(isInBoundingBox(HORMUZ_BBOX.minLat, HORMUZ_BBOX.minLon, HORMUZ_BBOX)).toBe(true);
    expect(isInBoundingBox(HORMUZ_BBOX.maxLat, HORMUZ_BBOX.maxLon, HORMUZ_BBOX)).toBe(true);
  });
});

describe('filterHormuzArea', () => {
  it('keeps events within bounding box', () => {
    const events = [
      { lat: 26.5, lon: 56.3, title: 'Hormuz event' },
      { lat: 33.89, lon: 35.5, title: 'Beirut event' },
      { lat: 25.0, lon: 55.0, title: 'UAE event' },
    ];
    const filtered = filterHormuzArea(events);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.title)).toContain('Hormuz event');
    expect(filtered.map((e) => e.title)).toContain('UAE event');
  });

  it('returns empty array for empty input', () => {
    expect(filterHormuzArea([])).toEqual([]);
  });

  it('excludes events with null coordinates', () => {
    const events = [{ lat: null, lon: null, title: 'No coords' }];
    expect(filterHormuzArea(events)).toEqual([]);
  });
});

// ── Parsing iranwarlive feed items ────────────────────────────────

const SAMPLE_ITEM = {
  event_id: 'IRW-V4-1773163910853-0',
  type: 'Air strike',
  location: 'Bandar Abbas, Iran',
  timestamp: '2026-03-10T17:31:03.315Z',
  confidence: 'OSINT',
  event_summary: 'On 2026-03-10, an Air strike targeted naval base at Bandar Abbas',
  source_url: 'https://www.bbc.com/news/articles/test123',
  _osint_meta: {
    casualties: 3,
    coordinates: {
      lat: 27.18,
      lng: 56.27,
    },
  },
};

describe('parseIranWarLiveItem', () => {
  it('extracts lat/lon from _osint_meta.coordinates', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    expect(parsed.lat).toBe(27.18);
    expect(parsed.lon).toBe(56.27);
  });

  it('returns null coords when _osint_meta is missing', () => {
    const item = { ...SAMPLE_ITEM, _osint_meta: undefined };
    const parsed = parseIranWarLiveItem(item);
    expect(parsed.lat).toBeNull();
    expect(parsed.lon).toBeNull();
  });

  it('extracts event_id, type, location, timestamp, confidence', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    expect(parsed.event_id).toBe('IRW-V4-1773163910853-0');
    expect(parsed.type).toBe('Air strike');
    expect(parsed.location).toBe('Bandar Abbas, Iran');
    expect(parsed.confidence).toBe('OSINT');
    expect(parsed.summary).toContain('Bandar Abbas');
    expect(parsed.source_url).toContain('bbc.com');
  });

  it('parses timestamp to Date', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe('2026-03-10T17:31:03.315Z');
  });

  it('extracts casualties from _osint_meta', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    expect(parsed.casualties).toBe(3);
  });
});

// ── Normalization to DataEvent schema ─────────────────────────────

describe('normalizeEvent', () => {
  const parsed = {
    event_id: 'IRW-V4-1773163910853-0',
    type: 'Air strike',
    lat: 27.18,
    lon: 56.27,
    timestamp: new Date('2026-03-10T17:31:03.315Z'),
    confidence: 'OSINT',
    location: 'Bandar Abbas, Iran',
    summary: 'On 2026-03-10, an Air strike targeted naval base',
    source_url: 'https://www.bbc.com/news/articles/test123',
    casualties: 3,
  };

  it('produces correct DataEvent shape', () => {
    const event = normalizeEvent(parsed);
    expect(event).toMatchObject({
      source: 'liveuamap',
      confidence: 'medium',
      lat: 27.18,
      lon: 56.27,
    });
  });

  it('generates id as liveuamap:<type>:<hash>', () => {
    const event = normalizeEvent(parsed);
    expect(event.id).toMatch(/^liveuamap:incident:[a-f0-9]+$/);
  });

  it('maps event type to DataEvent type', () => {
    const event = normalizeEvent(parsed);
    expect(event.type).toBe('incident');
  });

  it('converts timestamp to unix ms', () => {
    const event = normalizeEvent(parsed);
    expect(typeof event.timestamp).toBe('number');
    expect(event.timestamp).toBe(new Date('2026-03-10T17:31:03.315Z').getTime());
  });

  it('includes location and casualties in data payload', () => {
    const event = normalizeEvent(parsed);
    expect(event.data.location).toBe('Bandar Abbas, Iran');
    expect(event.data.casualties).toBe(3);
    expect(event.data.originalType).toBe('Air strike');
  });

  it('sets title and description', () => {
    const event = normalizeEvent(parsed);
    expect(event.title).toContain('Air strike');
    expect(event.title).toContain('Bandar Abbas');
    expect(event.description).toContain('naval base');
  });

  it('includes source URL', () => {
    const event = normalizeEvent(parsed);
    expect(event.url).toBe('https://www.bbc.com/news/articles/test123');
  });
});

// ── Deduplication ─────────────────────────────────────────────────

describe('deduplicateEvents', () => {
  it('removes events with duplicate ids', () => {
    const events = [
      { id: 'liveuamap:incident:abc123', title: 'A' },
      { id: 'liveuamap:incident:abc123', title: 'A dupe' },
      { id: 'liveuamap:incident:def456', title: 'B' },
    ];
    const deduped = deduplicateEvents(events);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe('A');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateEvents([])).toEqual([]);
  });
});

// ── parseFeed ─────────────────────────────────────────────────────

describe('parseFeed', () => {
  it('parses full feed JSON into normalized events', () => {
    const feedJson = {
      items: [
        SAMPLE_ITEM,
        {
          ...SAMPLE_ITEM,
          event_id: 'IRW-V4-9999-1',
          _osint_meta: {
            casualties: 0,
            coordinates: { lat: 33.89, lng: 35.5 }, // Beirut - outside bbox
          },
        },
      ],
    };
    const events = parseFeed(feedJson);
    // Only the Bandar Abbas event is in Hormuz area
    expect(events).toHaveLength(1);
    expect(events[0].lat).toBe(27.18);
    expect(events[0].source).toBe('liveuamap');
  });

  it('returns empty array for feed with no items', () => {
    expect(parseFeed({ items: [] })).toEqual([]);
    expect(parseFeed({})).toEqual([]);
  });

  it('skips items with missing coordinates', () => {
    const feedJson = {
      items: [{ ...SAMPLE_ITEM, _osint_meta: undefined }],
    };
    const events = parseFeed(feedJson);
    expect(events).toEqual([]);
  });

  it('deduplicates events with same event_id', () => {
    const feedJson = {
      items: [SAMPLE_ITEM, SAMPLE_ITEM],
    };
    const events = parseFeed(feedJson);
    expect(events).toHaveLength(1);
  });
});

// ── Integration: full pipeline ────────────────────────────────────

describe('full pipeline', () => {
  it('processes sample feed through parse → filter → normalize → dedup', () => {
    const feedJson = {
      items: [
        SAMPLE_ITEM,
        {
          event_id: 'IRW-V4-2222-0',
          type: 'Strike',
          location: 'Kharg Island, Iran',
          timestamp: '2026-03-09T10:00:00Z',
          confidence: 'Confirmed',
          event_summary: 'Strike on Kharg Island oil terminal',
          source_url: 'https://reuters.com/test',
          _osint_meta: {
            casualties: 0,
            coordinates: { lat: 29.23, lng: 50.32 },
          },
        },
      ],
    };
    const events = parseFeed(feedJson);

    // Both are in Hormuz area
    expect(events.length).toBeGreaterThanOrEqual(1);
    for (const ev of events) {
      expect(ev.source).toBe('liveuamap');
      expect(ev.id).toMatch(/^liveuamap:/);
      expect(typeof ev.timestamp).toBe('number');
      expect(ev.lat).not.toBeNull();
      expect(ev.lon).not.toBeNull();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Liveuamap AJAX scraping functions
// ══════════════════════════════════════════════════════════════════════

// ── mapPicpathToType ────────────────────────────────────────────────

describe('mapPicpathToType', () => {
  it('maps bomb-N to incident', () => {
    expect(mapPicpathToType('bomb-10')).toBe('incident');
    expect(mapPicpathToType('bomb-1')).toBe('incident');
  });

  it('maps ship-N to military_sighting', () => {
    expect(mapPicpathToType('ship-10')).toBe('military_sighting');
    expect(mapPicpathToType('ship-2')).toBe('military_sighting');
  });

  it('maps speech-N to news', () => {
    expect(mapPicpathToType('speech-1')).toBe('news');
    expect(mapPicpathToType('speech-10')).toBe('news');
  });

  it('maps explode/destroy/rocket to incident', () => {
    expect(mapPicpathToType('explode-10')).toBe('incident');
    expect(mapPicpathToType('destroy-10')).toBe('incident');
    expect(mapPicpathToType('rocket-1')).toBe('incident');
  });

  it('maps shahed to incident', () => {
    expect(mapPicpathToType('shahed-1')).toBe('incident');
  });

  it('maps natural_resource to infrastructure_damage', () => {
    expect(mapPicpathToType('natural_resource-11')).toBe('infrastructure_damage');
  });

  it('returns incident for unknown picpath', () => {
    expect(mapPicpathToType('unknown-5')).toBe('incident');
  });

  it('returns incident for null/undefined', () => {
    expect(mapPicpathToType(null)).toBe('incident');
    expect(mapPicpathToType(undefined)).toBe('incident');
  });
});

// ── mapColorToConfidence ────────────────────────────────────────────

describe('mapColorToConfidence', () => {
  it('maps color 10 (red/active conflict) to medium', () => {
    expect(mapColorToConfidence(10)).toBe('medium');
  });

  it('maps color 11 (dark red) to medium', () => {
    expect(mapColorToConfidence(11)).toBe('medium');
  });

  it('maps color 1 (blue/politics) to low', () => {
    expect(mapColorToConfidence(1)).toBe('low');
  });

  it('maps color 2 (green/military) to low', () => {
    expect(mapColorToConfidence(2)).toBe('low');
  });

  it('defaults to low for unknown color ids', () => {
    expect(mapColorToConfidence(99)).toBe('low');
    expect(mapColorToConfidence(0)).toBe('low');
  });
});

// ── normalizeVenue ──────────────────────────────────────────────────

const SAMPLE_VENUE = {
  id: 22827573,
  name: 'US Navy escorted an oil tanker through the Strait of Hormuz',
  lat: '26.61391',
  lng: '56.38733',
  timestamp: 1773162840,
  picpath: 'ship-10',
  color_id: 10,
  cat_id: 19,
  link: 'https://iran.liveuamap.com/en/2026/10-march-17-us-navy-escorted-an-oil-tanker-through-the-strait',
  source: 'https://x.com/JavierBlas/status/2031418502842638813',
  location: 'Hormuz Strait',
  description: '',
  udescription: '',
};

describe('normalizeVenue', () => {
  it('produces correct DataEvent shape', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event).toMatchObject({
      source: 'liveuamap',
      type: 'military_sighting',
      confidence: 'medium',
    });
  });

  it('generates id as liveuamap:<type>:<hash>', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.id).toMatch(/^liveuamap:military_sighting:[a-f0-9]+$/);
  });

  it('parses string lat/lng to numbers', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.lat).toBeCloseTo(26.61391, 4);
    expect(event.lon).toBeCloseTo(56.38733, 4);
  });

  it('converts unix seconds timestamp to milliseconds', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.timestamp).toBe(1773162840 * 1000);
  });

  it('includes title from venue name', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.title).toContain('US Navy');
    expect(event.title).toContain('Strait of Hormuz');
  });

  it('includes liveuamap link as url', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.url).toContain('iran.liveuamap.com');
  });

  it('preserves picpath as icon', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.icon).toBe('ship-10');
  });

  it('includes metadata in data payload', () => {
    const event = normalizeVenue(SAMPLE_VENUE);
    expect(event.data.liveuamapId).toBe(22827573);
    expect(event.data.location).toBe('Hormuz Strait');
    expect(event.data.catId).toBe(19);
    expect(event.data.colorId).toBe(10);
    expect(event.data.originalSource).toContain('x.com');
  });

  it('handles null/NaN coordinates gracefully', () => {
    const bad = { ...SAMPLE_VENUE, lat: 'invalid', lng: null };
    const event = normalizeVenue(bad);
    expect(event.lat).toBeNull();
    expect(event.lon).toBeNull();
  });

  it('handles missing name gracefully', () => {
    const noName = { ...SAMPLE_VENUE, name: undefined };
    const event = normalizeVenue(noName);
    expect(event.title).toBe('');
  });

  it('maps bomb picpath to incident type', () => {
    const bombVenue = { ...SAMPLE_VENUE, picpath: 'bomb-10' };
    const event = normalizeVenue(bombVenue);
    expect(event.type).toBe('incident');
  });
});

// ── parseVenuesResponse ─────────────────────────────────────────────

describe('parseVenuesResponse', () => {
  const sampleJson = {
    last: 0,
    venues: [SAMPLE_VENUE],
    globaltime: '1773164683',
    amount: 1,
  };

  it('parses base64-encoded JSON', () => {
    const encoded = Buffer.from(JSON.stringify(sampleJson)).toString('base64');
    const { events, meta } = parseVenuesResponse(encoded);
    expect(events).toHaveLength(1);
    expect(events[0].lat).toBeCloseTo(26.61391, 4);
    expect(meta.globaltime).toBe('1773164683');
  });

  it('parses plain JSON string fallback', () => {
    const { events, meta } = parseVenuesResponse(JSON.stringify(sampleJson));
    expect(events).toHaveLength(1);
    expect(meta.total).toBe(1);
  });

  it('returns empty for invalid data', () => {
    const { events } = parseVenuesResponse('not-valid-anything');
    expect(events).toEqual([]);
  });

  it('filters out venues with invalid coordinates', () => {
    const badJson = {
      venues: [
        SAMPLE_VENUE,
        { ...SAMPLE_VENUE, id: 99, lat: 'bad', lng: 'bad' },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(badJson)).toString('base64');
    const { events } = parseVenuesResponse(encoded);
    expect(events).toHaveLength(1);
  });

  it('returns meta with globaltime, total, last', () => {
    const encoded = Buffer.from(JSON.stringify(sampleJson)).toString('base64');
    const { meta } = parseVenuesResponse(encoded);
    expect(meta).toHaveProperty('globaltime');
    expect(meta).toHaveProperty('total');
    expect(meta).toHaveProperty('last');
  });

  it('handles empty venues array', () => {
    const emptyJson = { venues: [], globaltime: '123', amount: 0 };
    const encoded = Buffer.from(JSON.stringify(emptyJson)).toString('base64');
    const { events } = parseVenuesResponse(encoded);
    expect(events).toEqual([]);
  });
});

// ── extractSessionVars ──────────────────────────────────────────────

describe('extractSessionVars', () => {
  it('extracts rain and globaltime from page HTML', () => {
    const html = `
      <script>
        var garden='citadel';
        var rain='compass';
        var globaltime = '1773164683';
      </script>
    `;
    const vars = extractSessionVars(html);
    expect(vars).not.toBeNull();
    expect(vars.rain).toBe('compass');
    expect(vars.globaltime).toBe('1773164683');
  });

  it('returns null when variables are missing', () => {
    expect(extractSessionVars('<html></html>')).toBeNull();
    expect(extractSessionVars('')).toBeNull();
  });

  it('returns null when only rain is present', () => {
    const html = `var rain='test'`;
    expect(extractSessionVars(html)).toBeNull();
  });

  it('returns null when only globaltime is present', () => {
    const html = `var globaltime = '12345'`;
    expect(extractSessionVars(html)).toBeNull();
  });
});

// ── Liveuamap venue integration ─────────────────────────────────────

describe('liveuamap venue pipeline', () => {
  it('normalizes and filters venues through full pipeline', () => {
    const venues = [
      SAMPLE_VENUE,
      { ...SAMPLE_VENUE, id: 100, lat: '35.6515', lng: '51.40331', name: 'Tehran event' }, // Tehran - may be outside Hormuz
      { ...SAMPLE_VENUE, id: 101, lat: '26.5', lng: '56.3', name: 'Hormuz event' },
    ];

    const json = { venues, globaltime: '123', amount: 3 };
    const encoded = Buffer.from(JSON.stringify(json)).toString('base64');
    const { events } = parseVenuesResponse(encoded);

    // All should parse
    expect(events).toHaveLength(3);

    // Filter to Hormuz region
    const hormuzEvents = filterHormuzArea(events);
    // SAMPLE_VENUE (26.6N, 56.4E) and Hormuz event (26.5N, 56.3E) are in bbox
    // Tehran (35.6N, 51.4E) exceeds maxLat of 32
    expect(hormuzEvents).toHaveLength(2);

    for (const e of hormuzEvents) {
      expect(e.source).toBe('liveuamap');
      expect(e.id).toMatch(/^liveuamap:/);
      expect(typeof e.timestamp).toBe('number');
    }
  });
});
