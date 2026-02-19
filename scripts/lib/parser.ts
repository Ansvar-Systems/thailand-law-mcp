/**
 * Krisdika HTML parser for Thai legislation.
 *
 * Parses HTML pages from krisdika.go.th into structured data.
 * Uses cheerio for HTML parsing.
 *
 * Handles:
 * - Act listing pages for metadata (title in Thai, B.E. year, English title if available)
 * - Act content: sections marked with "มาตรา" (mattra = section/article)
 * - B.E. year conversion: B.E. year - 543 = CE year
 * - Both Thai and English versions where available
 * - Section numbering (Krisdika typically uses Arabic numerals)
 */

import * as cheerio from 'cheerio';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActIndexEntry {
  title_th: string;
  title_en: string;
  sysId: string;
  beYear: number;
  ceYear: number;
  url: string;
  category: string;
}

export interface ParsedProvision {
  provision_ref: string;
  section: string;
  title: string;
  content: string;
  language: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title_th: string;
  title_en: string;
  short_name: string;
  status: 'in_force';
  be_year: number;
  ce_year: number;
  issued_date: string;
  url: string;
  provisions: ParsedProvision[];
}

// ─────────────────────────────────────────────────────────────────────────────
// B.E. / CE conversion
// ─────────────────────────────────────────────────────────────────────────────

export function beToce(beYear: number): number {
  return beYear - 543;
}

export function ceToBe(ceYear: number): number {
  return ceYear + 543;
}

/**
 * Extract B.E. year from text like "พ.ศ. 2562" or "B.E. 2562".
 */
export function extractBeYear(text: string): number | null {
  const thaiMatch = text.match(/พ\.ศ\.\s*(\d{4})/);
  if (thaiMatch) return parseInt(thaiMatch[1], 10);

  const englishMatch = text.match(/B\.?E\.?\s*(\d{4})/);
  if (englishMatch) return parseInt(englishMatch[1], 10);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing page parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a Krisdika library listing page to extract legislation index entries.
 */
export function parseListingPage(html: string, category: string): ActIndexEntry[] {
  const $ = cheerio.load(html);
  const entries: ActIndexEntry[] = [];

  // Krisdika typically lists acts in table rows or anchor elements
  $('a[href*="getfile"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href') ?? '';
    const titleText = $el.text().trim();

    if (!titleText || titleText.length < 5) return;

    // Extract sysid from href
    const sysIdMatch = href.match(/sysid=(\d+)/);
    if (!sysIdMatch) return;

    const sysId = sysIdMatch[1];
    const beYear = extractBeYear(titleText);
    if (!beYear) return;

    const ceYear = beToce(beYear);

    entries.push({
      title_th: titleText,
      title_en: '', // Will be populated during content fetch
      sysId,
      beYear,
      ceYear,
      url: `https://www.krisdika.go.th${href.startsWith('/') ? '' : '/'}${href}`,
      category,
    });
  });

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Act content parser
// ─────────────────────────────────────────────────────────────────────────────

// มาตรา followed by a number (Arabic numerals commonly used on Krisdika)
const SECTION_PATTERN = /มาตรา\s+(\d+(?:\/\d+)?)/g;
const SECTION_PATTERN_EN = /Section\s+(\d+(?:\/\d+)?)/gi;

/**
 * Parse HTML content of a Thai act into structured provisions.
 */
export function parseActContent(html: string, language: 'th' | 'en' = 'th'): ParsedProvision[] {
  const $ = cheerio.load(html);
  const provisions: ParsedProvision[] = [];

  // Get the main body text
  const bodyText = $('body').text();

  // Split the body into sections based on "มาตรา" markers (Thai) or "Section" (English)
  const sectionPattern = language === 'th' ? SECTION_PATTERN : SECTION_PATTERN_EN;

  // Find all section positions
  const sectionPositions: { index: number; sectionNum: string }[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  sectionPattern.lastIndex = 0;

  while ((match = sectionPattern.exec(bodyText)) !== null) {
    sectionPositions.push({
      index: match.index,
      sectionNum: match[1],
    });
  }

  // Extract text between section markers
  for (let i = 0; i < sectionPositions.length; i++) {
    const start = sectionPositions[i].index;
    const end = i + 1 < sectionPositions.length
      ? sectionPositions[i + 1].index
      : bodyText.length;

    const rawContent = bodyText.slice(start, end).trim();
    const sectionNum = sectionPositions[i].sectionNum;

    // Normalize whitespace
    const content = rawContent.replace(/\s+/g, ' ').trim();

    if (content.length > 0) {
      provisions.push({
        provision_ref: `s${sectionNum}`,
        section: sectionNum,
        title: '',
        content,
        language,
      });
    }
  }

  return provisions;
}

/**
 * Build a document ID from act information.
 * Format: abbreviation-beYear (e.g., "pdpa-be2562")
 */
export function buildDocumentId(titleEn: string, titleTh: string, beYear: number): string {
  // Try to derive an abbreviation from the English title
  const abbreviation = deriveAbbreviation(titleEn, titleTh);
  return `${abbreviation}-be${beYear}`.toLowerCase();
}

/**
 * Build a short name from the title.
 */
export function buildShortName(titleEn: string, titleTh: string, ceYear: number): string {
  const abbreviation = deriveAbbreviation(titleEn, titleTh).toUpperCase();
  return `${abbreviation} ${ceYear}`;
}

/**
 * Derive an abbreviation from the English or Thai title.
 */
function deriveAbbreviation(titleEn: string, titleTh: string): string {
  if (titleEn) {
    // Known abbreviations
    const known: Record<string, string> = {
      'personal data protection act': 'pdpa',
      'computer crime act': 'cca',
      'cybersecurity act': 'csa',
      'electronic transactions act': 'eta',
      'civil and commercial code': 'ccc',
      'constitution': 'constitution',
    };

    const lower = titleEn.toLowerCase();
    for (const [key, abbr] of Object.entries(known)) {
      if (lower.includes(key)) return abbr;
    }

    // Generate abbreviation from significant words
    const words = titleEn
      .replace(/[()]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'act', 'of', 'in', 'to', 'with'].includes(w.toLowerCase()));

    if (words.length >= 2) {
      return words.slice(0, 4).map(w => w[0]).join('').toLowerCase();
    }
  }

  // Fallback: use first few characters of Thai title
  if (titleTh) {
    return titleTh.slice(0, 10).replace(/\s+/g, '-');
  }

  return 'unknown';
}
