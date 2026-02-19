import { describe, it, expect } from 'vitest';
import { parseCitation } from '../../src/citation/parser.js';

describe('parseCitation', () => {
  it('parses English citation with B.E. year', () => {
    const result = parseCitation('Section 3, Personal Data Protection Act B.E. 2562');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.title).toBe('Personal Data Protection Act');
    expect(result.be_year).toBe(2562);
    expect(result.ce_year).toBe(2019);
  });

  it('parses English citation with B.E. year and CE in parens', () => {
    const result = parseCitation('Section 3, Personal Data Protection Act B.E. 2562 (2019)');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.be_year).toBe(2562);
  });

  it('parses short citation', () => {
    const result = parseCitation('s. 3, PDPA 2019');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.ce_year).toBe(2019);
  });

  it('parses trailing section citation', () => {
    const result = parseCitation('Personal Data Protection Act B.E. 2562, s. 3');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.be_year).toBe(2562);
  });

  it('parses Thai citation', () => {
    const result = parseCitation('มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.be_year).toBe(2562);
    expect(result.ce_year).toBe(2019);
  });

  it('parses ID-based citation', () => {
    const result = parseCitation('pdpa-be2562, s. 3');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.title).toBe('pdpa-be2562');
  });

  it('returns invalid for unparseable citation', () => {
    const result = parseCitation('some random text');
    expect(result.valid).toBe(false);
    expect(result.type).toBe('unknown');
  });

  it('handles section with subsection', () => {
    const result = parseCitation('Section 3(1), Personal Data Protection Act B.E. 2562');
    expect(result.valid).toBe(true);
    expect(result.section).toBe('3');
    expect(result.subsection).toBe('1');
  });
});
