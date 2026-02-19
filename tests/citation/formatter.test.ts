import { describe, it, expect } from 'vitest';
import { formatCitation } from '../../src/citation/formatter.js';
import type { ParsedCitation } from '../../src/types/index.js';

describe('formatCitation', () => {
  const parsed: ParsedCitation = {
    valid: true,
    type: 'statute',
    title: 'Personal Data Protection Act',
    be_year: 2562,
    ce_year: 2019,
    section: '3',
  };

  it('formats in full_en format', () => {
    const result = formatCitation(parsed, 'full_en');
    expect(result).toBe('Section 3, Personal Data Protection Act B.E. 2562 (2019)');
  });

  it('formats in full_th format', () => {
    const result = formatCitation(parsed, 'full_th');
    expect(result).toBe('มาตรา 3 Personal Data Protection Act พ.ศ. 2562');
  });

  it('formats in short format', () => {
    const result = formatCitation(parsed, 'short');
    expect(result).toBe('s. 3, Personal Data Protection Act 2019');
  });

  it('formats in pinpoint format', () => {
    const result = formatCitation(parsed, 'pinpoint');
    expect(result).toBe('s. 3');
  });

  it('handles subsection', () => {
    const withSub: ParsedCitation = { ...parsed, subsection: '1' };
    const result = formatCitation(withSub, 'pinpoint');
    expect(result).toBe('s. 3(1)');
  });

  it('returns empty string for invalid citation', () => {
    const invalid: ParsedCitation = { valid: false, type: 'unknown' };
    expect(formatCitation(invalid)).toBe('');
  });
});
