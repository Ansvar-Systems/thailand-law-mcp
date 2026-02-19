import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { checkCurrency } from '../../src/tools/check-currency.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('checkCurrency', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('confirms PDPA is in force', async () => {
    const result = await checkCurrency(db, { document_id: 'pdpa-be2562' });
    expect(result.results).not.toBeNull();
    expect(result.results!.is_current).toBe(true);
    expect(result.results!.be_year).toBe(2562);
    expect(result.results!.ce_year).toBe(2019);
  });

  it('returns null for non-existent document', async () => {
    const result = await checkCurrency(db, { document_id: 'nonexistent-be9999' });
    expect(result.results).toBeNull();
  });

  it('checks provision existence', async () => {
    const result = await checkCurrency(db, { document_id: 'pdpa-be2562', provision_ref: 's3' });
    expect(result.results!.provision_exists).toBe(true);
  });
});
