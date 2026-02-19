import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { getEUBasis } from '../../src/tools/get-eu-basis.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('getEUBasis', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('returns GDPR reference for PDPA', async () => {
    const result = await getEUBasis(db, { document_id: 'pdpa-be2562' });
    expect(result.results.eu_documents.length).toBeGreaterThan(0);
    const gdpr = result.results.eu_documents.find(d => d.id === 'regulation:2016/679');
    expect(gdpr).toBeDefined();
    expect(gdpr!.reference_type).toBe('modeled_on');
  });

  it('returns NIS reference for Cybersecurity Act', async () => {
    const result = await getEUBasis(db, { document_id: 'csa-be2562' });
    expect(result.results.eu_documents.length).toBeGreaterThan(0);
    const nis = result.results.eu_documents.find(d => d.id === 'directive:2016/1148');
    expect(nis).toBeDefined();
  });

  it('throws for non-existent document', async () => {
    await expect(getEUBasis(db, { document_id: 'nonexistent-be9999' })).rejects.toThrow();
  });
});
