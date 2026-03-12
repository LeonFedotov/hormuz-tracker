import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SUBREDDIT_URLS,
  INCIDENT_KEYWORDS,
  LOCATION_PATTERNS,
  classifyPost,
  extractLocationMention,
  normalizePost,
  deduplicatePosts,
  fetchSubreddit,
  fetchAllSubreddits,
} from '../adapters/reddit.js';

// --- Constants ---

describe('SUBREDDIT_URLS', () => {
  it('contains exactly 4 subreddit search URLs', () => {
    expect(SUBREDDIT_URLS).toHaveLength(4);
  });

  it('includes CredibleDefense, geopolitics, OSINT, CombatFootage', () => {
    const subs = SUBREDDIT_URLS.map((u) => {
      const m = u.match(/\/r\/(\w+)\//);
      return m ? m[1] : null;
    });
    expect(subs).toContain('CredibleDefense');
    expect(subs).toContain('geopolitics');
    expect(subs).toContain('OSINT');
    expect(subs).toContain('CombatFootage');
  });

  it('all URLs use old.reddit.com JSON search endpoint', () => {
    for (const url of SUBREDDIT_URLS) {
      expect(url).toMatch(/^https:\/\/old\.reddit\.com\/r\/\w+\/search\.json\?/);
    }
  });

  it('all URLs sort by new and limit to 25', () => {
    for (const url of SUBREDDIT_URLS) {
      expect(url).toContain('sort=new');
      expect(url).toContain('limit=25');
      expect(url).toContain('t=week');
    }
  });
});

describe('INCIDENT_KEYWORDS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(INCIDENT_KEYWORDS)).toBe(true);
    expect(INCIDENT_KEYWORDS.length).toBeGreaterThan(0);
  });

  it('includes critical military/conflict terms', () => {
    const kw = INCIDENT_KEYWORDS.map((k) => k.toLowerCase());
    for (const term of ['strike', 'attack', 'bombing', 'missile', 'ship']) {
      expect(kw.some((k) => k.includes(term))).toBe(true);
    }
  });
});

// --- classifyPost ---

describe('classifyPost', () => {
  it('returns "incident" for titles with strike keywords', () => {
    expect(classifyPost({ title: 'US strikes Iranian naval base near Hormuz' })).toBe('incident');
  });

  it('returns "incident" for titles mentioning ship attacks', () => {
    expect(classifyPost({ title: 'Tanker attacked in Strait of Hormuz' })).toBe('incident');
  });

  it('returns "incident" for titles with bombing keywords', () => {
    expect(classifyPost({ title: 'Bombing reported near Bandar Abbas port' })).toBe('incident');
  });

  it('returns "incident" for titles with missile keywords', () => {
    expect(classifyPost({ title: 'Missile fired at commercial vessel near Hormuz' })).toBe('incident');
  });

  it('returns "news" for generic geopolitical discussion', () => {
    expect(classifyPost({ title: 'Analysis of Iran sanctions impact on shipping' })).toBe('news');
  });

  it('returns "news" for posts without incident indicators', () => {
    expect(classifyPost({ title: 'Discussion thread about Hormuz geopolitics' })).toBe('news');
  });

  it('is case-insensitive', () => {
    expect(classifyPost({ title: 'MASSIVE STRIKE on port facilities' })).toBe('incident');
  });

  it('checks selftext too for classification', () => {
    expect(
      classifyPost({
        title: 'Update from the region',
        selftext: 'Reports of a drone strike on oil tanker',
      })
    ).toBe('incident');
  });
});

// --- extractLocationMention ---

describe('extractLocationMention', () => {
  it('returns approx coords for "Strait of Hormuz"', () => {
    const loc = extractLocationMention('Tanker seized in the Strait of Hormuz');
    expect(loc).not.toBeNull();
    expect(loc.lat).toBeCloseTo(26.56, 0);
    expect(loc.lon).toBeCloseTo(56.25, 0);
  });

  it('returns approx coords for "Bandar Abbas"', () => {
    const loc = extractLocationMention('Explosion reported near Bandar Abbas');
    expect(loc).not.toBeNull();
    expect(loc.lat).toBeCloseTo(27.18, 0);
    expect(loc.lon).toBeCloseTo(56.28, 0);
  });

  it('returns null when no known location is mentioned', () => {
    const loc = extractLocationMention('General discussion about geopolitics');
    expect(loc).toBeNull();
  });

  it('handles case insensitivity', () => {
    const loc = extractLocationMention('STRAIT OF HORMUZ blockade imminent');
    expect(loc).not.toBeNull();
  });

  it('recognizes Kharg Island', () => {
    const loc = extractLocationMention('Strike on Kharg Island oil terminal');
    expect(loc).not.toBeNull();
    expect(loc.lat).toBeCloseTo(29.23, 0);
  });

  it('recognizes Fujairah', () => {
    const loc = extractLocationMention('Ships rerouting to Fujairah');
    expect(loc).not.toBeNull();
  });
});

// --- normalizePost ---

describe('normalizePost', () => {
  const samplePost = {
    id: 'abc123',
    title: 'Iranian navy fires warning shots at tanker near Hormuz',
    selftext: 'Reports coming in from multiple sources about warning shots fired.',
    permalink: '/r/CredibleDefense/comments/abc123/iranian_navy/',
    created_utc: 1710000000,
    score: 42,
    num_comments: 15,
    subreddit: 'CredibleDefense',
    url: 'https://example.com/article',
  };

  it('produces correct id format', () => {
    const event = normalizePost(samplePost);
    expect(event.id).toBe('reddit:abc123');
  });

  it('classifies as incident when title has incident keywords', () => {
    const event = normalizePost(samplePost);
    expect(event.type).toBe('incident');
  });

  it('sets source to reddit', () => {
    const event = normalizePost(samplePost);
    expect(event.source).toBe('reddit');
  });

  it('sets confidence to low', () => {
    const event = normalizePost(samplePost);
    expect(event.confidence).toBe('low');
  });

  it('converts created_utc to milliseconds', () => {
    const event = normalizePost(samplePost);
    expect(event.timestamp).toBe(1710000000 * 1000);
  });

  it('includes title', () => {
    const event = normalizePost(samplePost);
    expect(event.title).toBe(samplePost.title);
  });

  it('truncates description to 500 chars', () => {
    const longText = 'A'.repeat(1000);
    const event = normalizePost({ ...samplePost, selftext: longText });
    expect(event.description.length).toBeLessThanOrEqual(500);
  });

  it('builds correct reddit URL from permalink', () => {
    const event = normalizePost(samplePost);
    expect(event.url).toBe('https://reddit.com/r/CredibleDefense/comments/abc123/iranian_navy/');
  });

  it('includes subreddit, score, and num_comments in data', () => {
    const event = normalizePost(samplePost);
    expect(event.data.subreddit).toBe('CredibleDefense');
    expect(event.data.score).toBe(42);
    expect(event.data.num_comments).toBe(15);
  });

  it('sets lat/lon from location extraction when possible', () => {
    const event = normalizePost(samplePost);
    // "near Hormuz" should trigger location extraction
    expect(event.lat).not.toBeNull();
    expect(event.lon).not.toBeNull();
  });

  it('sets lat/lon to null when no location found', () => {
    const event = normalizePost({
      ...samplePost,
      title: 'General geopolitical analysis',
      selftext: 'Nothing location-specific here',
    });
    expect(event.lat).toBeNull();
    expect(event.lon).toBeNull();
  });

  it('handles missing selftext gracefully', () => {
    const event = normalizePost({ ...samplePost, selftext: undefined });
    expect(event.description).toBe('');
  });

  it('conforms to event schema fields', () => {
    const event = normalizePost(samplePost);
    const requiredFields = ['id', 'type', 'lat', 'lon', 'timestamp', 'source', 'confidence', 'title', 'url', 'data'];
    for (const field of requiredFields) {
      expect(event).toHaveProperty(field);
    }
  });
});

// --- deduplicatePosts ---

describe('deduplicatePosts', () => {
  it('removes duplicate posts by id', () => {
    const posts = [
      { id: 'a', title: 'Post A', created_utc: 1 },
      { id: 'b', title: 'Post B', created_utc: 2 },
      { id: 'a', title: 'Post A duplicate', created_utc: 3 },
    ];
    const result = deduplicatePosts(posts);
    expect(result).toHaveLength(2);
  });

  it('keeps the first occurrence', () => {
    const posts = [
      { id: 'a', title: 'First', created_utc: 1 },
      { id: 'a', title: 'Second', created_utc: 2 },
    ];
    const result = deduplicatePosts(posts);
    expect(result[0].title).toBe('First');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicatePosts([])).toEqual([]);
  });
});

// --- fetchSubreddit (mocked) ---

describe('fetchSubreddit', () => {
  it('is a function', () => {
    expect(typeof fetchSubreddit).toBe('function');
  });
});

describe('fetchAllSubreddits', () => {
  it('is a function', () => {
    expect(typeof fetchAllSubreddits).toBe('function');
  });
});
