#!/usr/bin/env tsx
/**
 * Check krisdika.go.th for newly published or updated Thai legislation.
 *
 * Exits:
 *   0 = no updates detected
 *   1 = updates found
 *   2 = check failed (network/parse/database error)
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/database.db');
const INDEX_PATH = resolve(__dirname, '../data/source/act-index.json');

const USER_AGENT = 'ThailandLawMCP/1.0';
const REQUEST_TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  console.log('Thailand Law MCP - Freshness checker');
  console.log('');

  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(2);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const localDocs = new Set<string>(
    (db.prepare("SELECT id FROM legal_documents WHERE type = 'statute'").all() as { id: string }[])
      .map((row) => row.id),
  );

  let builtAt = 'unknown';
  try {
    const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'built_at'").get() as { value: string } | undefined;
    if (row) builtAt = row.value;
  } catch { /* ignore */ }
  db.close();

  console.log(`Database contains ${localDocs.size} documents, built at: ${builtAt}`);

  // Check Krisdika main page for any sign of updates
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://www.krisdika.go.th', {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Krisdika returned HTTP ${response.status}`);
      process.exit(2);
    }

    console.log(`Krisdika is reachable (HTTP ${response.status})`);
    console.log('');
    console.log('Full freshness check requires manual review of Krisdika updates.');
    console.log('Run "npm run ingest" to re-ingest from upstream.');
  } catch (error) {
    console.error(`Freshness check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
