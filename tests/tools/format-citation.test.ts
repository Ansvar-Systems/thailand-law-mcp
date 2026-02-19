import { describe, it, expect } from 'vitest';
import { formatCitationTool } from '../../src/tools/format-citation.js';

describe('formatCitationTool', () => {
  it('formats a PDPA citation in full_en', async () => {
    const result = await formatCitationTool({
      citation: 'Section 3, Personal Data Protection Act B.E. 2562',
      format: 'full_en',
    });
    expect(result.results.valid).toBe(true);
    expect(result.results.formatted).toContain('Section 3');
    expect(result.results.formatted).toContain('B.E. 2562');
    expect(result.results.formatted).toContain('2019');
  });

  it('formats in pinpoint format', async () => {
    const result = await formatCitationTool({
      citation: 'Section 3, Personal Data Protection Act B.E. 2562',
      format: 'pinpoint',
    });
    expect(result.results.formatted).toBe('s. 3');
  });

  it('returns invalid for empty input', async () => {
    const result = await formatCitationTool({ citation: '' });
    expect(result.results.valid).toBe(false);
  });
});
