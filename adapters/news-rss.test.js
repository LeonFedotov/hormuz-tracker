import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FEED_SOURCES,
  RELEVANCE_KEYWORDS,
  parseRssXml,
  isRelevant,
  normalizeEvent,
  hashArticle,
  deduplicateEvents,
} from './news-rss.js';

// ── Feed source configuration ──────────────────────────────────────

describe('FEED_SOURCES', () => {
  it('contains at least 4 feed sources', () => {
    expect(FEED_SOURCES.length).toBeGreaterThanOrEqual(4);
  });

  it('each source has name and url', () => {
    for (const src of FEED_SOURCES) {
      expect(src).toHaveProperty('name');
      expect(src).toHaveProperty('url');
      expect(src.url).toMatch(/^https?:\/\//);
    }
  });

  it('includes google_news, reuters, bbc, al_jazeera', () => {
    const names = FEED_SOURCES.map((s) => s.name);
    expect(names).toContain('google_news');
    expect(names).toContain('bbc');
    expect(names).toContain('al_jazeera');
  });
});

// ── Relevance keywords ─────────────────────────────────────────────

describe('RELEVANCE_KEYWORDS', () => {
  it('includes all required keywords', () => {
    const required = [
      'hormuz', 'iran', 'strait', 'gulf', 'shipping',
      'tanker', 'naval', 'blockade', 'oil',
    ];
    for (const kw of required) {
      expect(RELEVANCE_KEYWORDS).toContain(kw);
    }
  });
});

// ── XML parsing ────────────────────────────────────────────────────

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Iran threatens to block Strait of Hormuz</title>
      <link>https://example.com/article1</link>
      <description>Iran's navy has threatened to block oil tankers.</description>
      <pubDate>Mon, 10 Mar 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Weather update for Tuesday</title>
      <link>https://example.com/article2</link>
      <description>Sunny skies expected across the region.</description>
      <pubDate>Mon, 10 Mar 2026 13:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Naval buildup in Persian Gulf</title>
    <link href="https://example.com/atom1"/>
    <summary>US deploys carrier group near Hormuz strait.</summary>
    <updated>2026-03-10T14:00:00Z</updated>
  </entry>
</feed>`;

describe('parseRssXml', () => {
  it('parses RSS 2.0 items', () => {
    const items = parseRssXml(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Iran threatens to block Strait of Hormuz');
    expect(items[0].link).toBe('https://example.com/article1');
    expect(items[0].description).toContain('oil tankers');
    expect(items[0].pubDate).toBeTruthy();
  });

  it('parses Atom feed entries', () => {
    const items = parseRssXml(SAMPLE_ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Naval buildup in Persian Gulf');
    expect(items[0].link).toBe('https://example.com/atom1');
    expect(items[0].description).toContain('carrier group');
  });

  it('returns empty array for empty/invalid XML', () => {
    expect(parseRssXml('')).toEqual([]);
    expect(parseRssXml('not xml at all')).toEqual([]);
    expect(parseRssXml('<rss><channel></channel></rss>')).toEqual([]);
  });

  it('handles missing optional fields gracefully', () => {
    const xml = `<rss><channel><item><title>Test</title></item></channel></rss>`;
    const items = parseRssXml(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Test');
    expect(items[0].link).toBe('');
    expect(items[0].description).toBe('');
  });
});

// ── Relevance filtering ────────────────────────────────────────────

describe('isRelevant', () => {
  it('returns true for articles mentioning hormuz', () => {
    expect(isRelevant({ title: 'Strait of Hormuz crisis deepens', description: '' })).toBe(true);
  });

  it('returns true when keyword is in description only', () => {
    expect(isRelevant({ title: 'Breaking news', description: 'Tanker seized near iran coast' })).toBe(true);
  });

  it('returns false for unrelated articles', () => {
    expect(isRelevant({ title: 'Weather update for Tuesday', description: 'Sunny skies expected.' })).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isRelevant({ title: 'IRAN NAVAL EXERCISES', description: '' })).toBe(true);
  });

  it('matches partial words containing keywords', () => {
    // "shipping" inside "shipments"
    expect(isRelevant({ title: 'Oil shipments disrupted', description: '' })).toBe(true);
  });
});

// ── Hash generation ────────────────────────────────────────────────

describe('hashArticle', () => {
  it('produces a short hex string', () => {
    const h = hashArticle('https://example.com/article1');
    expect(h).toMatch(/^[a-f0-9]+$/);
    expect(h.length).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic', () => {
    const a = hashArticle('https://example.com/x');
    const b = hashArticle('https://example.com/x');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = hashArticle('https://example.com/a');
    const b = hashArticle('https://example.com/b');
    expect(a).not.toBe(b);
  });
});

// ── Event normalization ────────────────────────────────────────────

describe('normalizeEvent', () => {
  const article = {
    title: 'Iran threatens Hormuz blockade',
    link: 'https://example.com/article1',
    description: 'Full description here.',
    pubDate: 'Mon, 10 Mar 2026 12:00:00 GMT',
  };

  it('produces correct event shape', () => {
    const event = normalizeEvent(article, 'google_news');
    expect(event).toMatchObject({
      type: 'news',
      lat: null,
      lon: null,
      source: 'news_rss',
      confidence: 'high',
    });
  });

  it('generates id with news:<source>:<hash> format', () => {
    const event = normalizeEvent(article, 'google_news');
    expect(event.id).toMatch(/^news:google_news:[a-f0-9]+$/);
  });

  it('converts pubDate to unix ms timestamp', () => {
    const event = normalizeEvent(article, 'bbc');
    expect(typeof event.timestamp).toBe('number');
    expect(event.timestamp).toBeGreaterThan(0);
    // Mon, 10 Mar 2026 12:00:00 GMT
    expect(event.timestamp).toBe(new Date('Mon, 10 Mar 2026 12:00:00 GMT').getTime());
  });

  it('sets timestamp to 0 for unparseable dates', () => {
    const bad = { ...article, pubDate: 'not-a-date' };
    const event = normalizeEvent(bad, 'reuters');
    expect(event.timestamp).toBe(0);
  });

  it('includes feedSource in data', () => {
    const event = normalizeEvent(article, 'al_jazeera');
    expect(event.data.feedSource).toBe('al_jazeera');
  });

  it('copies title, description, url', () => {
    const event = normalizeEvent(article, 'bbc');
    expect(event.title).toBe(article.title);
    expect(event.description).toBe(article.description);
    expect(event.url).toBe(article.link);
  });
});

// ── Deduplication ──────────────────────────────────────────────────

describe('deduplicateEvents', () => {
  it('removes events with duplicate ids', () => {
    const events = [
      { id: 'news:bbc:abc123', title: 'A' },
      { id: 'news:bbc:abc123', title: 'A duplicate' },
      { id: 'news:bbc:def456', title: 'B' },
    ];
    const deduped = deduplicateEvents(events);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe('A'); // keeps first
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateEvents([])).toEqual([]);
  });
});

// ── Integration: parse + filter + normalize pipeline ───────────────

describe('full pipeline', () => {
  it('parses RSS, filters relevant, and normalizes', () => {
    const items = parseRssXml(SAMPLE_RSS);
    const relevant = items.filter(isRelevant);
    const events = relevant.map((a) => normalizeEvent(a, 'test_feed'));

    // Only the first article matches (hormuz, iran, tanker, oil)
    expect(relevant).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0].title).toContain('Hormuz');
    expect(events[0].type).toBe('news');
    expect(events[0].id).toMatch(/^news:test_feed:/);
  });
});
