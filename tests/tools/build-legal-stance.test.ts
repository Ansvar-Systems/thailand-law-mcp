import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { buildLegalStance } from '../../src/tools/build-legal-stance.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('buildLegalStance', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('returns provisions for "personal data"', async () => {
    const result = await buildLegalStance(db, { query: 'personal data' });
    expect(result.results.provisions.length).toBeGreaterThan(0);
    expect(result.results.total_citations).toBeGreaterThan(0);
  });

  it('returns empty for blank query', async () => {
    const result = await buildLegalStance(db, { query: '' });
    expect(result.results.provisions).toHaveLength(0);
  });
});
