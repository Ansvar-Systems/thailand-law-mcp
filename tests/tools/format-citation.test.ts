import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from '@ansvar/mcp-sqlite';
import { formatCitationTool } from '../../src/tools/format-citation.js';
import { createTestDb } from '../fixtures/test-db.js';

let db: InstanceType<typeof Database>;

describe('formatCitationTool', () => {
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => { db?.close(); });

  it('formats a PDPA citation in full format', async () => {
    const result = await formatCitationTool(db, {
      citation: 'Section 3, Personal Data Protection Act B.E. 2562',
      format: 'full',
    });
    expect(result.formatted).toContain('Section 3');
  });

  it('formats in pinpoint format', async () => {
    const result = await formatCitationTool(db, {
      citation: 'Section 3, Personal Data Protection Act B.E. 2562',
      format: 'pinpoint',
    });
    expect(result.formatted).toBe('s 3');
  });

  it('returns original for empty input', async () => {
    const result = await formatCitationTool(db, { citation: '' });
    expect(result.formatted).toBe('');
  });
});
