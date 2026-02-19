/**
 * Thailand legal citation formatter.
 *
 * Formats:
 *   full_th:   "มาตรา {section} {thai_title} พ.ศ. {be_year}"
 *   full_en:   "Section {section}, {english_title} B.E. {be_year} ({ce_year})"
 *   short:     "s. {section}, {abbreviation} {ce_year}"
 *   pinpoint:  "s. {section}"
 */

import type { ParsedCitation, CitationFormat } from '../types/index.js';

export function formatCitation(
  parsed: ParsedCitation,
  format: CitationFormat = 'full_en'
): string {
  if (!parsed.valid || !parsed.section) {
    return '';
  }

  const pinpoint = buildPinpoint(parsed);

  switch (format) {
    case 'full_th':
      return `มาตรา ${pinpoint} ${parsed.title ?? ''} พ.ศ. ${parsed.be_year ?? ''}`.trim();

    case 'full_en':
      return `Section ${pinpoint}, ${parsed.title ?? ''} B.E. ${parsed.be_year ?? ''} (${parsed.ce_year ?? ''})`.trim();

    case 'short':
      return `s. ${pinpoint}, ${parsed.abbreviation ?? parsed.title ?? ''} ${parsed.ce_year ?? ''}`.trim();

    case 'pinpoint':
      return `s. ${pinpoint}`;

    default:
      return `Section ${pinpoint}, ${parsed.title ?? ''} B.E. ${parsed.be_year ?? ''} (${parsed.ce_year ?? ''})`.trim();
  }
}

function buildPinpoint(parsed: ParsedCitation): string {
  let ref = parsed.section ?? '';
  if (parsed.subsection) {
    ref += `(${parsed.subsection})`;
  }
  if (parsed.paragraph) {
    ref += `(${parsed.paragraph})`;
  }
  return ref;
}
