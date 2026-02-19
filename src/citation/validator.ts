/**
 * Thailand legal citation validator.
 *
 * Validates a citation string against the database to ensure the document
 * and provision actually exist (zero-hallucination enforcement).
 * Handles both Thai and English title lookups.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import type { ValidationResult } from '../types/index.js';
import { parseCitation } from './parser.js';

export function validateCitation(db: Database, citation: string): ValidationResult {
  const parsed = parseCitation(citation);
  const warnings: string[] = [];

  if (!parsed.valid) {
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [parsed.error ?? 'Invalid citation format'],
    };
  }

  // Look up document by title match (try both Thai and English)
  const titleSearch = parsed.title ?? '';
  const yearSearch = parsed.be_year ?? parsed.ce_year ?? 0;

  const doc = db.prepare(
    `SELECT id, title, title_en, status FROM legal_documents
     WHERE (title LIKE ? OR title_en LIKE ? OR short_name LIKE ?)
     AND (be_year = ? OR ce_year = ? OR ? = 0)
     LIMIT 1`
  ).get(
    `%${titleSearch}%`, `%${titleSearch}%`, `%${titleSearch}%`,
    yearSearch, yearSearch, yearSearch
  ) as { id: string; title: string; title_en: string | null; status: string } | undefined;

  if (!doc) {
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [`Document "${titleSearch}" not found in database`],
    };
  }

  if (doc.status === 'repealed') {
    warnings.push('This statute has been repealed');
  }

  // Check provision existence
  let provisionExists = false;
  if (parsed.section) {
    const pinpoint = [
      parsed.section,
      parsed.subsection ? `(${parsed.subsection})` : '',
      parsed.paragraph ? `(${parsed.paragraph})` : '',
    ].join('');
    const provisionRef = `s${pinpoint}`;
    const allowPrefixMatch = parsed.subsection == null && parsed.paragraph == null;

    const prov = db.prepare(
      `SELECT 1
       FROM legal_provisions
       WHERE document_id = ?
         AND (
           provision_ref = ?
           OR section = ?
           OR (
             ? = 1
             AND (
               provision_ref LIKE ?
               OR section LIKE ?
             )
           )
         )`
    ).get(
      doc.id,
      provisionRef,
      pinpoint,
      allowPrefixMatch ? 1 : 0,
      `${provisionRef}(%`,
      `${pinpoint}(%`,
    );
    provisionExists = !!prov;

    if (!provisionExists) {
      warnings.push(`Section ${pinpoint} not found in ${doc.title_en ?? doc.title}`);
    }
  }

  return {
    citation: parsed,
    document_exists: true,
    provision_exists: provisionExists,
    document_title: doc.title_en ?? doc.title,
    status: doc.status,
    warnings,
  };
}
