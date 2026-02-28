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
 * Parse an OCS search API JSON response into legislation index entries.
 *
 * The body parameter should be a JSON string (array of OCSLawEntry objects
 * from the new ocs.go.th search API) or HTML (legacy krisdika.go.th format).
 */
export function parseListingPage(body: string, category: string): ActIndexEntry[] {
  // Try parsing as JSON first (new OCS API format)
  try {
    const entries: ActIndexEntry[] = [];
    const items = JSON.parse(body);

    if (!Array.isArray(items)) return entries;

    for (const item of items) {
      const lawNameTh = item.lawNameTh ?? '';
      const lawNameEn = (item.lawNameEn && item.lawNameEn !== false) ? String(item.lawNameEn) : '';
      const encTimelineID = item.encTimelineID ?? '';

      if (!lawNameTh && !lawNameEn) continue;

      // Extract B.E. year from the title or publishDate
      let beYear = extractBeYear(lawNameTh);
      if (!beYear && item.publishDate) {
        // publishDate format: "27/5/2562" (Thai B.E. year)
        const dateMatch = item.publishDate.match(/(\d{4})$/);
        if (dateMatch) {
          const yr = parseInt(dateMatch[1], 10);
          // Years > 2400 are B.E., otherwise treat as C.E.
          if (yr > 2400) {
            beYear = yr;
          } else {
            beYear = ceToBe(yr);
          }
        }
      }
      if (!beYear) continue;

      const ceYear = beToce(beYear);

      // Use encTimelineID as the sysId (it's the unique identifier in the new system)
      entries.push({
        title_th: lawNameTh,
        title_en: lawNameEn,
        sysId: encTimelineID,
        beYear,
        ceYear,
        url: `https://searchlaw.ocs.go.th/council-of-state/#/public/doc/${encTimelineID}`,
        category,
      });
    }

    return entries;
  } catch {
    // Not JSON — fall through to legacy HTML parsing
  }

  // Legacy HTML parsing (for backward compatibility with old krisdika.go.th format)
  const $ = cheerio.load(body);
  const entries: ActIndexEntry[] = [];

  $('a[href*="getfile"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href') ?? '';
    const titleText = $el.text().trim();

    if (!titleText || titleText.length < 5) return;

    const sysIdMatch = href.match(/sysid=(\d+)/);
    if (!sysIdMatch) return;

    const sysId = sysIdMatch[1];
    const beYear = extractBeYear(titleText);
    if (!beYear) return;

    const ceYear = beToce(beYear);

    entries.push({
      title_th: titleText,
      title_en: '',
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
 * Uses sysId (timelineId) as the unique suffix to prevent collisions.
 * Format: abbreviation-beYear-sysId (e.g., "pdpa-be2562-abc123")
 */
export function buildDocumentId(titleEn: string, titleTh: string, beYear: number, sysId?: string): string {
  const abbreviation = deriveAbbreviation(titleEn, titleTh);
  const base = `${abbreviation}-be${beYear}`.toLowerCase();
  // Append sysId to guarantee uniqueness — Thai title truncation caused 204+ collisions
  if (sysId) {
    // Use last 8 chars of sysId (encoded timelineId) as a short unique suffix
    const suffix = sysId.slice(-8).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${base}-${suffix}`;
  }
  return base;
}

/**
 * Build a short name from the title.
 */
export function buildShortName(titleEn: string, titleTh: string, ceYear: number): string {
  const abbreviation = deriveAbbreviation(titleEn, titleTh).toUpperCase();
  return `${abbreviation} ${ceYear}`;
}

/**
 * Common Thai legal prefixes to strip when building document IDs.
 * These prefixes are extremely common and cause collisions.
 */
const THAI_PREFIXES = [
  'พระราชบัญญัติประกอบรัฐธรรมนูญว่าด้วย',
  'พระราชบัญญัติประกอบรัฐธรรมนูญ',
  'พระราชกำหนดแก้ไขเพิ่มเติม',
  'พระราชบัญญัติแก้ไขเพิ่มเติม',
  'พระราชกำหนด',
  'พระราชบัญญัติ',
  'ประมวลกฎหมาย',
  'กฎหมายลักษณะ',
  'รัฐธรรมนูญแห่งราชอาณาจักรไทย',
  'รัฐธรรมนูญ',
  'ประกาศคณะ',
  'คำสั่งคณะ',
];

/**
 * Thai noise words / year markers to strip from the core title.
 */
const THAI_NOISE = [
  /\(ยกเลิก\)/g,
  /\(ฉบับที่\s*\d+\)/g,
  /พุทธศักราช\s*\d*/g,
  /พระพุทธศักราช\s*\d*/g,
  /รัตนโกสินทร์\s*ศก\s*\d*/g,
  /รัตนโกสินทร์ศก\s*\d*/g,
  /พ\.ศ\.\s*\d*/g,
  /ว่าด้วย/g,
];

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

  // For Thai-only titles: strip the common prefix and use the remaining unique part
  if (titleTh) {
    let core = titleTh.trim();

    // Remove the common Thai legal prefix
    for (const prefix of THAI_PREFIXES) {
      if (core.startsWith(prefix)) {
        core = core.slice(prefix.length).trim();
        break;
      }
    }

    // Remove noise words and year markers
    for (const noise of THAI_NOISE) {
      core = core.replace(noise, '');
    }

    // Trim whitespace
    core = core.replace(/\s+/g, ' ').trim();

    // If we still have meaningful Thai text, use up to 50 chars
    // to avoid collisions between similar titles (e.g. land transfer acts)
    if (core.length > 0) {
      // Sanitize for filesystem: replace spaces with hyphens, keep Thai chars
      const slug = core.slice(0, 50).replace(/\s+/g, '-').replace(/[./\\:]/g, '');
      if (slug.length > 0) return slug;
    }

    // Absolute fallback: use first 30 chars of original title
    return titleTh.slice(0, 30).replace(/\s+/g, '-').replace(/[./\\:]/g, '');
  }

  return 'unknown';
}
