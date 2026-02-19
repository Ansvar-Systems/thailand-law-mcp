import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { getProvision } from '../../src/tools/get-provision.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('getProvision', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('retrieves PDPA section 3 by ID', async () => {
    const result = await getProvision(db, { document_id: 'pdpa-be2562', section: '3' });
    expect(result.results).not.toBeNull();
    const prov = result.results as any;
    expect(prov.section).toBe('3');
    expect(prov.content).toContain('personal data');
  });

  it('resolves by title LIKE match', async () => {
    const result = await getProvision(db, { document_id: 'Personal Data Protection Act', section: '3' });
    expect(result.results).not.toBeNull();
  });

  it('returns null for non-existent provision', async () => {
    const result = await getProvision(db, { document_id: 'pdpa-be2562', section: '999' });
    expect(result.results).toBeNull();
  });

  it('returns all provisions when no section specified', async () => {
    const result = await getProvision(db, { document_id: 'pdpa-be2562' });
    const provisions = result.results as any[];
    expect(provisions.length).toBeGreaterThan(0);
  });
});
