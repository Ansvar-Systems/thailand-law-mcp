import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { validateCitation } from '../../src/citation/validator.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('validateCitation', () => {
  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(() => {
    db?.close();
  });

  it('validates a known PDPA citation', () => {
    const result = validateCitation(db, 'Section 3, Personal Data Protection Act B.E. 2562');
    expect(result.document_exists).toBe(true);
    expect(result.provision_exists).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects a non-existent act', () => {
    const result = validateCitation(db, 'Section 1, Fictional Act B.E. 2599');
    expect(result.document_exists).toBe(false);
  });

  it('warns for a section that does not exist', () => {
    const result = validateCitation(db, 'Section 999, Personal Data Protection Act B.E. 2562');
    expect(result.document_exists).toBe(true);
    expect(result.provision_exists).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns invalid for unparseable citation', () => {
    const result = validateCitation(db, 'garbage text');
    expect(result.citation.valid).toBe(false);
    expect(result.document_exists).toBe(false);
  });
});
