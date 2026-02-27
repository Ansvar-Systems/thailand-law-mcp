#!/usr/bin/env tsx
/**
 * Thailand Law MCP — Ingestion Pipeline
 *
 * Two-phase ingestion of Thai legislation from ocs.go.th
 * (formerly krisdika.go.th, which now redirects to ocs.go.th):
 *
 *   Phase 1 (Discovery): Index legislation via OCS search API
 *   Phase 2 (Content): Use existing seed data for content (full text
 *     is not available via the API — the new SPA viewer requires
 *     session auth for its backend)
 *
 * Usage:
 *   npm run ingest                    # Full ingestion (discovery + seed merge)
 *   npm run ingest -- --limit 20      # Test with 20 acts
 *   npm run ingest -- --skip-discovery # Reuse cached act index
 *   npm run ingest -- --resume        # Skip already-cached seed files
 *
 * Data is sourced from the Office of the Council of State (government open data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLibrarianIndex, searchLawsByKeyword, type OCSLawEntry } from './lib/fetcher.js';
import { parseListingPage, parseActContent, buildDocumentId, buildShortName, beToce, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_PATH = path.join(SOURCE_DIR, 'act-index.json');

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; skipDiscovery: boolean; resume: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipDiscovery = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-discovery') {
      skipDiscovery = true;
    } else if (args[i] === '--resume') {
      resume = true;
    }
  }

  return { limit, skipDiscovery, resume };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery — Build act index from OCS search API
// ─────────────────────────────────────────────────────────────────────────────

async function discoverActs(): Promise<ActIndexEntry[]> {
  console.log('Phase 1: Discovering Thai legislation from ocs.go.th...\n');

  // Fetch Thai laws via the search API (iterates through Thai alphabet)
  process.stdout.write('  Fetching Thai laws (all letters)...');
  const result = await fetchLibrarianIndex('law');

  if (result.status !== 200) {
    console.log(` HTTP ${result.status} — failed.`);
    return [];
  }

  const allEntries = parseListingPage(result.body, 'all');
  console.log(` ${allEntries.length} entries found`);

  // Also try English translations
  process.stdout.write('  Fetching English translations...');
  const engResult = await fetchLibrarianIndex('law_en');

  if (engResult.status === 200) {
    const engEntries = parseListingPage(engResult.body, 'law_en');
    console.log(` ${engEntries.length} entries found`);

    // Merge English titles into the main index where the encTimelineID matches
    const engByEncId = new Map<string, ActIndexEntry>();
    for (const entry of engEntries) {
      engByEncId.set(entry.sysId, entry);
    }

    for (const entry of allEntries) {
      const eng = engByEncId.get(entry.sysId);
      if (eng && eng.title_en) {
        entry.title_en = eng.title_en;
      }
    }
  } else {
    console.log(` skipped (HTTP ${engResult.status})`);
  }

  // Deduplicate by sysId (encTimelineID)
  const seen = new Set<string>();
  const deduped: ActIndexEntry[] = [];
  for (const entry of allEntries) {
    if (!seen.has(entry.sysId)) {
      seen.add(entry.sysId);
      deduped.push(entry);
    }
  }

  console.log(`\n  Discovered ${deduped.length} unique acts\n`);

  // Save index
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(deduped, null, 2));
  console.log(`  Index saved to ${INDEX_PATH}\n`);

  return deduped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Content — Create seed entries from act index
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create seed files for discovered acts.
 *
 * Because the new ocs.go.th portal serves law content through an Angular SPA
 * with a session-gated backend API, we cannot automatically scrape full text.
 * Instead, we:
 *   1. Preserve existing curated seed files (which have full English content)
 *   2. Create metadata-only entries for newly discovered laws
 *   3. The metadata entries have empty provisions but are still useful for
 *      the search index (users can find a law by name/year and get a link)
 */
async function fetchAndParseActs(acts: ActIndexEntry[], limit: number | null): Promise<void> {
  const toProcess = limit ? acts.slice(0, limit) : acts;
  console.log(`Phase 2: Creating seed entries for ${toProcess.length} acts...\n`);

  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let created = 0;
  let totalProvisions = 0;

  // Count provisions in existing seed files
  const existingSeeds = fs.readdirSync(SEED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'));
  for (const file of existingSeeds) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8'));
      totalProvisions += (content.provisions ?? []).length;
    } catch {
      // ignore
    }
  }

  for (const act of toProcess) {
    const docId = buildDocumentId(act.title_en, act.title_th, act.beYear);
    const seedFile = path.join(SEED_DIR, `${docId}.json`);

    // Skip if seed already exists (preserve curated content)
    if (fs.existsSync(seedFile)) {
      skipped++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${created} created)`);
      }
      continue;
    }

    // Determine status from the OCS state code
    let status: 'in_force' | 'amended' | 'repealed' = 'in_force';
    // Check if the Thai title contains "(ยกเลิก)" meaning "repealed"
    if (act.title_th.includes('ยกเลิก')) {
      status = 'repealed';
    }

    const shortName = buildShortName(act.title_en, act.title_th, act.ceYear);

    const parsed: ParsedAct = {
      id: docId,
      type: 'statute',
      title_th: act.title_th,
      title_en: act.title_en || '',
      short_name: shortName,
      status,
      be_year: act.beYear,
      ce_year: act.ceYear,
      issued_date: `${act.ceYear}-01-01`,
      url: act.url,
      provisions: [], // No provisions available from the API
    };

    fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
    created++;
    processed++;

    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${created} created)`);
    }
  }

  console.log(`\nPhase 2 complete:`);
  console.log(`  Total discovered: ${toProcess.length}`);
  console.log(`  Skipped (already have content): ${skipped}`);
  console.log(`  New metadata entries created: ${created}`);
  console.log(`  Total provisions in seed data: ${totalProvisions}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, skipDiscovery, resume } = parseArgs();

  console.log('Thailand Law MCP — Ingestion Pipeline');
  console.log('======================================\n');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipDiscovery) console.log(`  --skip-discovery`);
  if (resume) console.log(`  --resume`);
  console.log('');

  let acts: ActIndexEntry[];

  if (skipDiscovery && fs.existsSync(INDEX_PATH)) {
    console.log(`Using cached act index from ${INDEX_PATH}\n`);
    acts = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    console.log(`  ${acts.length} acts in index\n`);
  } else {
    acts = await discoverActs();
  }

  await fetchAndParseActs(acts, limit);

  // Print census summary
  const seedFiles = fs.readdirSync(SEED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'));
  let totalDocs = 0;
  let totalProvisions = 0;
  let docsWithProvisions = 0;
  for (const file of seedFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8'));
      totalDocs++;
      const provCount = (content.provisions ?? []).length;
      totalProvisions += provCount;
      if (provCount > 0) docsWithProvisions++;
    } catch {
      // ignore
    }
  }

  console.log(`\nCensus summary:`);
  console.log(`  Total documents: ${totalDocs}`);
  console.log(`  Documents with provisions: ${docsWithProvisions}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log('\nIngestion complete.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
