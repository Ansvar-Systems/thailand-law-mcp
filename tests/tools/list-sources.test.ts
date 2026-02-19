import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { listSources } from '../../src/tools/list-sources.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('listSources', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('returns Thailand jurisdiction', async () => {
    const result = await listSources(db);
    expect(result.results.jurisdiction).toBe('Thailand (TH)');
  });

  it('includes Krisdika source', async () => {
    const result = await listSources(db);
    const krisdika = result.results.sources.find(s => s.name.includes('Krisdika'));
    expect(krisdika).toBeDefined();
    expect(krisdika!.languages).toContain('th');
    expect(krisdika!.languages).toContain('en');
  });

  it('includes B.E. calendar note', async () => {
    const result = await listSources(db);
    expect(result.results.calendar_note).toContain('Buddhist Era');
  });

  it('reports document counts', async () => {
    const result = await listSources(db);
    expect(result.results.database.document_count).toBeGreaterThan(0);
    expect(result.results.database.provision_count).toBeGreaterThan(0);
  });
});
