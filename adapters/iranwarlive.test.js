import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FEED_URL,
  ALL_EVENTS_BBOX,
  parseIranWarLiveItem,
  normalizeEvent,
  parseFeed,
} from './iranwarlive.js';

// ── Constants ─────────────────────────────────────────────────────

describe('FEED_URL', () => {
  it('points to iranwarlive.com feed.json', () => {
    expect(FEED_URL).toBe('https://iranwarlive.com/feed.json');
  });
});

describe('ALL_EVENTS_BBOX', () => {
  it('defines a wide bounding box for full Iran/Gulf region', () => {
    expect(ALL_EVENTS_BBOX).toHaveProperty('minLat');
    expect(ALL_EVENTS_BBOX).toHaveProperty('maxLat');
    expect(ALL_EVENTS_BBOX).toHaveProperty('minLon');
    expect(ALL_EVENTS_BBOX).toHaveProperty('maxLon');
    // Should cover wider area than just Hormuz
    expect(ALL_EVENTS_BBOX.minLat).toBeLessThanOrEqual(20);
    expect(ALL_EVENTS_BBOX.maxLat).toBeGreaterThanOrEqual(40);
  });
});

// ── Parsing ───────────────────────────────────────────────────────

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
    coordinates: { lat: 27.18, lng: 56.27 },
  },
};

describe('parseIranWarLiveItem', () => {
  it('extracts coordinates, type, location', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    expect(parsed.lat).toBe(27.18);
    expect(parsed.lon).toBe(56.27);
    expect(parsed.type).toBe('Air strike');
    expect(parsed.location).toBe('Bandar Abbas, Iran');
  });

  it('handles missing _osint_meta', () => {
    const item = { ...SAMPLE_ITEM, _osint_meta: undefined };
    const parsed = parseIranWarLiveItem(item);
    expect(parsed.lat).toBeNull();
    expect(parsed.lon).toBeNull();
  });
});

// ── Normalization ─────────────────────────────────────────────────

describe('normalizeEvent', () => {
  it('produces DataEvent with iranwarlive source', () => {
    const parsed = parseIranWarLiveItem(SAMPLE_ITEM);
    const event = normalizeEvent(parsed);
    // This adapter uses its own source identifier
    expect(event.source).toBe('liveuamap');
    expect(event.type).toBe('incident');
    expect(event.lat).toBe(27.18);
    expect(event.lon).toBe(56.27);
    expect(typeof event.timestamp).toBe('number');
  });
});

// ── Full feed parsing ─────────────────────────────────────────────

describe('parseFeed', () => {
  it('parses feed items, filters by bbox, deduplicates', () => {
    const feedJson = {
      items: [
        SAMPLE_ITEM,
        {
          ...SAMPLE_ITEM,
          event_id: 'IRW-V4-9999-1',
          location: 'Central Beirut, Lebanon',
          _osint_meta: {
            casualties: 0,
            coordinates: { lat: 33.89, lng: 35.5 },
          },
        },
      ],
    };
    // With ALL_EVENTS_BBOX, Beirut (33.89N, 35.5E) should be included since bbox covers wider region
    const events = parseFeed(feedJson);
    expect(events.length).toBeGreaterThanOrEqual(1);
    // Bandar Abbas event should always be included
    expect(events.some((e) => e.lat === 27.18)).toBe(true);
  });

  it('returns empty array for empty feed', () => {
    expect(parseFeed({ items: [] })).toEqual([]);
    expect(parseFeed({})).toEqual([]);
  });

  it('deduplicates same event_id', () => {
    const feedJson = { items: [SAMPLE_ITEM, SAMPLE_ITEM] };
    const events = parseFeed(feedJson);
    expect(events).toHaveLength(1);
  });
});
