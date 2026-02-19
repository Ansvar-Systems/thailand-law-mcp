import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { validateEUCompliance } from '../../src/tools/validate-eu-compliance.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('validateEUCompliance', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('reports PDPA as compliant (has GDPR reference)', async () => {
    const result = await validateEUCompliance(db, { document_id: 'pdpa-be2562' });
    expect(result.results.compliance_status).toBe('compliant');
    expect(result.results.eu_references_found).toBeGreaterThan(0);
  });

  it('reports ETA as not_applicable (no EU references)', async () => {
    const result = await validateEUCompliance(db, { document_id: 'eta-be2544' });
    expect(result.results.compliance_status).toBe('not_applicable');
  });
});
