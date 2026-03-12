import { describe, it, expect } from 'vitest';
import {
  readEventFile,
  mergeAllEvents,
  deduplicateById,
} from '../server/collect.js';

// ── readEventFile ─────────────────────────────────────────────────

describe('readEventFile', () => {
  it('reads {_meta, events} format and returns events array', () => {
    const data = { _meta: { source: 'test' }, events: [{ id: 'a' }, { id: 'b' }] };
    const events = readEventFile(data);
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe('a');
  });

  it('reads bare array format', () => {
    const data = [{ id: 'x' }, { id: 'y' }];
    const events = readEventFile(data);
    expect(events).toHaveLength(2);
  });

  it('returns empty array for null/undefined', () => {
    expect(readEventFile(null)).toEqual([]);
    expect(readEventFile(undefined)).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    expect(readEventFile({})).toEqual([]);
  });

  it('returns empty array for object without events', () => {
    expect(readEventFile({ _meta: {} })).toEqual([]);
  });
});

// ── deduplicateById ───────────────────────────────────────────────

describe('deduplicateById', () => {
  it('removes events with duplicate ids', () => {
    const events = [
      { id: 'a', title: 'first' },
      { id: 'a', title: 'dupe' },
      { id: 'b', title: 'second' },
    ];
    const result = deduplicateById(events);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('first');
  });

  it('keeps events without ids', () => {
    const events = [
      { id: 'a' },
      { title: 'no id 1' },
      { title: 'no id 2' },
    ];
    const result = deduplicateById(events);
    // Events without ids should all be kept
    expect(result).toHaveLength(3);
  });

  it('returns empty for empty input', () => {
    expect(deduplicateById([])).toEqual([]);
  });
});

// ── mergeAllEvents ────────────────────────────────────────────────

describe('mergeAllEvents', () => {
  it('merges multiple event arrays and deduplicates', () => {
    const sources = [
      [{ id: 'a', timestamp: 1000 }, { id: 'b', timestamp: 2000 }],
      [{ id: 'b', timestamp: 2000 }, { id: 'c', timestamp: 3000 }],
    ];
    const result = mergeAllEvents(sources);
    expect(result).toHaveLength(3);
  });

  it('sorts by timestamp descending', () => {
    const sources = [
      [{ id: 'a', timestamp: 1000 }],
      [{ id: 'b', timestamp: 3000 }],
      [{ id: 'c', timestamp: 2000 }],
    ];
    const result = mergeAllEvents(sources);
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('c');
    expect(result[2].id).toBe('a');
  });

  it('handles empty arrays', () => {
    expect(mergeAllEvents([])).toEqual([]);
    expect(mergeAllEvents([[], []])).toEqual([]);
  });

  it('handles single source', () => {
    const sources = [[{ id: 'a', timestamp: 100 }]];
    const result = mergeAllEvents(sources);
    expect(result).toHaveLength(1);
  });
});
