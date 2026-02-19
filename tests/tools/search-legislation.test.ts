import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { searchLegislation } from '../../src/tools/search-legislation.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('searchLegislation', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('returns results for "personal data"', async () => {
    const result = await searchLegislation(db, { query: 'personal data' });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result._metadata.disclaimer).toContain('krisdika.go.th');
  });

  it('returns results for "computer" search', async () => {
    const result = await searchLegislation(db, { query: 'computer' });
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('returns empty for blank query', async () => {
    const result = await searchLegislation(db, { query: '' });
    expect(result.results).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    const result = await searchLegislation(db, { query: 'data', limit: 1 });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });
});
