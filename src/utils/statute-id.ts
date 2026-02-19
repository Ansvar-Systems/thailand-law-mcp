/**
 * Thai statute identifier handling.
 *
 * Thai statutes are identified by a slug derived from the act abbreviation
 * and Buddhist Era year, e.g. "pdpa-be2562".
 */

import type { Database } from '@ansvar/mcp-sqlite';

export function isValidStatuteId(id: string): boolean {
  return id.length > 0 && id.trim().length > 0;
}

export function statuteIdCandidates(id: string): string[] {
  const trimmed = id.trim().toLowerCase();
  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Also try the original casing
  candidates.add(id.trim());

  // Convert spaces/dashes to the other form
  if (trimmed.includes(' ')) {
    candidates.add(trimmed.replace(/\s+/g, '-'));
  }
  if (trimmed.includes('-')) {
    candidates.add(trimmed.replace(/-/g, ' '));
  }

  return [...candidates];
}

/**
 * Convert B.E. year to C.E. year. B.E. = C.E. + 543.
 */
export function beToce(beYear: number): number {
  return beYear - 543;
}

/**
 * Convert C.E. year to B.E. year. B.E. = C.E. + 543.
 */
export function ceToBe(ceYear: number): number {
  return ceYear + 543;
}

export function resolveExistingStatuteId(
  db: Database,
  inputId: string,
): string | null {
  // Try exact match first
  const exact = db.prepare(
    "SELECT id FROM legal_documents WHERE id = ? LIMIT 1"
  ).get(inputId) as { id: string } | undefined;

  if (exact) return exact.id;

  // Try LIKE match on title (English)
  const byTitle = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${inputId}%`, `%${inputId}%`) as { id: string } | undefined;

  if (byTitle) return byTitle.id;

  // Try LIKE match on short_name
  const byShort = db.prepare(
    "SELECT id FROM legal_documents WHERE short_name LIKE ? LIMIT 1"
  ).get(`%${inputId}%`) as { id: string } | undefined;

  return byShort?.id ?? null;
}
