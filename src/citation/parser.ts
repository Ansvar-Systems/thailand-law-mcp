/**
 * Thailand legal citation parser.
 *
 * Parses citations in multiple formats:
 * 1. Thai: "มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"
 * 2. English: "Section 3, Personal Data Protection Act B.E. 2562 (2019)"
 * 3. Short: "s. 3, PDPA 2019"
 * 4. ID-based: "pdpa-be2562, s. 3"
 */

import type { ParsedCitation } from '../types/index.js';

// Thai format: "มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"
const THAI_CITATION = /^มาตรา\s+(\d+(?:\/\d+)?(?:\(\d+\))*)\s+(.+?)\s+พ\.ศ\.\s*(\d{4})$/;

// English with B.E.: "Section 3, Personal Data Protection Act B.E. 2562 (2019)"
const ENGLISH_BE_CITATION = /^(?:Section|s\.?)\s+(\d+(?:\/\d+)?(?:\(\d+\))*)\s*,?\s+(.+?)\s+B\.?E\.?\s*(\d{4})(?:\s*\(\d{4}\))?$/i;

// English with CE year: "Section 3, Personal Data Protection Act 2019"
const ENGLISH_CE_CITATION = /^(?:Section|s\.?)\s+(\d+(?:\/\d+)?(?:\(\d+\))*)\s*,?\s+(.+?)\s+(\d{4})$/i;

// Short format: "s. 3, PDPA 2019"
const SHORT_CITATION = /^s\.?\s+(\d+(?:\/\d+)?(?:\(\d+\))*)\s*,?\s+(.+?)\s+(\d{4})$/i;

// Trailing section: "Personal Data Protection Act B.E. 2562, s. 3"
const TRAILING_SECTION_BE = /^(.+?)\s+B\.?E\.?\s*(\d{4})(?:\s*\(\d{4}\))?\s*,?\s*(?:Section|s\.?|มาตรา)\s*(\d+(?:\/\d+)?(?:\(\d+\))*)$/i;

// Trailing section CE: "Personal Data Protection Act 2019, s. 3"
const TRAILING_SECTION_CE = /^(.+?)\s+(\d{4})\s*,?\s*(?:Section|s\.?|มาตรา)\s*(\d+(?:\/\d+)?(?:\(\d+\))*)$/i;

// ID-based: "pdpa-be2562, s. 3"
const ID_BASED = /^([a-z][a-z0-9-]+)\s*,?\s*(?:Section|s\.?|มาตรา)\s*(\d+(?:\/\d+)?(?:\(\d+\))*)$/i;

// Section with subsection: "3(1)(a)"
const SECTION_REF = /^(\d+(?:\/\d+)?)(?:\((\d+)\))?(?:\(([a-z])\))?$/;

/** Known abbreviation to English title mapping */
const ABBREVIATION_MAP: Record<string, string> = {
  'pdpa': 'Personal Data Protection Act',
  'cca': 'Computer Crime Act',
  'csa': 'Cybersecurity Act',
  'eta': 'Electronic Transactions Act',
  'ccc': 'Civil and Commercial Code',
};

/** Known Thai short names to English */
const THAI_SHORT_MAP: Record<string, string> = {
  'พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล': 'Personal Data Protection Act',
  'พ.ร.บ.ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์': 'Computer Crime Act',
  'พ.ร.บ.การรักษาความมั่นคงปลอดภัยไซเบอร์': 'Cybersecurity Act',
  'พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์': 'Electronic Transactions Act',
  'ประมวลกฎหมายแพ่งและพาณิชย์': 'Civil and Commercial Code',
};

export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();

  // Thai format
  let match = trimmed.match(THAI_CITATION);
  if (match) {
    const beYear = parseInt(match[3], 10);
    const thaiTitle = match[2].trim();
    const englishTitle = resolveThaiTitle(thaiTitle);
    return parseSection(match[1], englishTitle ?? thaiTitle, beYear, beYear - 543, 'statute');
  }

  // English with B.E.
  match = trimmed.match(ENGLISH_BE_CITATION);
  if (match) {
    const beYear = parseInt(match[3], 10);
    return parseSection(match[1], match[2], beYear, beYear - 543, 'statute');
  }

  // Trailing section with B.E.
  match = trimmed.match(TRAILING_SECTION_BE);
  if (match) {
    const beYear = parseInt(match[2], 10);
    return parseSection(match[3], match[1], beYear, beYear - 543, 'statute');
  }

  // Short format
  match = trimmed.match(SHORT_CITATION);
  if (match) {
    const yearOrAbbrev = match[2].trim();
    const year = parseInt(match[3], 10);
    const resolved = resolveAbbreviation(yearOrAbbrev);
    const ceYear = year > 2400 ? year - 543 : year;
    const beYear = year > 2400 ? year : year + 543;
    return parseSection(match[1], resolved ?? yearOrAbbrev, beYear, ceYear, 'statute');
  }

  // ID-based
  match = trimmed.match(ID_BASED);
  if (match) {
    const idPart = match[1].toLowerCase();
    return {
      valid: true,
      type: 'statute',
      title: idPart,
      section: match[2],
    };
  }

  // English with CE year
  match = trimmed.match(ENGLISH_CE_CITATION);
  if (match) {
    const year = parseInt(match[3], 10);
    const ceYear = year > 2400 ? year - 543 : year;
    const beYear = year > 2400 ? year : year + 543;
    return parseSection(match[1], match[2], beYear, ceYear, 'statute');
  }

  // Trailing section with CE
  match = trimmed.match(TRAILING_SECTION_CE);
  if (match) {
    const year = parseInt(match[2], 10);
    const ceYear = year > 2400 ? year - 543 : year;
    const beYear = year > 2400 ? year : year + 543;
    return parseSection(match[3], match[1], beYear, ceYear, 'statute');
  }

  return {
    valid: false,
    type: 'unknown',
    error: `Could not parse Thai citation: "${trimmed}"`,
  };
}

function resolveThaiTitle(thaiTitle: string): string | undefined {
  for (const [key, value] of Object.entries(THAI_SHORT_MAP)) {
    if (thaiTitle.includes(key)) {
      return value;
    }
  }
  return undefined;
}

function resolveAbbreviation(abbrev: string): string | undefined {
  return ABBREVIATION_MAP[abbrev.toLowerCase()];
}

function parseSection(
  sectionStr: string,
  title: string,
  beYear: number,
  ceYear: number,
  type: 'statute' | 'royal_decree'
): ParsedCitation {
  const sectionMatch = sectionStr.match(SECTION_REF);
  if (!sectionMatch) {
    return {
      valid: true,
      type,
      title: title.trim(),
      be_year: beYear,
      ce_year: ceYear,
      section: sectionStr,
    };
  }

  return {
    valid: true,
    type,
    title: title.trim(),
    be_year: beYear,
    ce_year: ceYear,
    section: sectionMatch[1],
    subsection: sectionMatch[2] || undefined,
    paragraph: sectionMatch[3] || undefined,
  };
}
