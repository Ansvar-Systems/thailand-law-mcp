import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { validateCitationTool } from '../../src/tools/validate-citation.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('validateCitationTool', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('validates a correct PDPA citation', async () => {
    const result = await validateCitationTool(db, {
      citation: 'Section 3, Personal Data Protection Act B.E. 2562',
    });
    expect(result.results.valid).toBe(true);
    expect(result.results.document_exists).toBe(true);
    expect(result.results.provision_exists).toBe(true);
  });

  it('returns invalid for empty citation', async () => {
    const result = await validateCitationTool(db, { citation: '' });
    expect(result.results.valid).toBe(false);
  });
});
