#!/usr/bin/env tsx
/**
 * Thailand Law MCP — Ingestion Pipeline
 *
 * Two-phase ingestion of Thai legislation from krisdika.go.th:
 *   Phase 1 (Discovery): Index legislation from Krisdika library pages
 *   Phase 2 (Content): Fetch individual act HTML, parse sections
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 20      # Test with 20 acts
 *   npm run ingest -- --skip-discovery # Reuse cached act index
 *
 * Data is sourced from the Office of the Council of State (government open data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLibrarianIndex, fetchActPage, fetchActEnglish } from './lib/fetcher.js';
import { parseListingPage, parseActContent, buildDocumentId, buildShortName, beToce, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_PATH = path.join(SOURCE_DIR, 'act-index.json');

// Legislation categories to crawl on Krisdika
const CATEGORIES = [
  'กฎหมายเทคโนโลยีสารสนเทศ',     // Information Technology Law
  'กฎหมายอาญา',                    // Criminal Law
  'กฎหมายแพ่งและพาณิชย์',          // Civil and Commercial Law
  'กฎหมายรัฐธรรมนูญ',              // Constitutional Law
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; skipDiscovery: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipDiscovery = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-discovery') {
      skipDiscovery = true;
    }
  }

  return { limit, skipDiscovery };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery — Build act index from Krisdika library pages
// ─────────────────────────────────────────────────────────────────────────────

async function discoverActs(): Promise<ActIndexEntry[]> {
  console.log('Phase 1: Discovering Thai legislation from krisdika.go.th...\n');

  const allEntries: ActIndexEntry[] = [];

  for (const category of CATEGORIES) {
    process.stdout.write(`  Fetching category: ${category}...`);

    const result = await fetchLibrarianIndex(category);

    if (result.status !== 200) {
      console.log(` HTTP ${result.status} — skipping.`);
      continue;
    }

    const entries = parseListingPage(result.body, category);
    allEntries.push(...entries);
    console.log(` ${entries.length} entries found`);
  }

  // Deduplicate by sysId
  const seen = new Set<string>();
  const deduped: ActIndexEntry[] = [];
  for (const entry of allEntries) {
    if (!seen.has(entry.sysId)) {
      seen.add(entry.sysId);
      deduped.push(entry);
    }
  }

  console.log(`\n  Discovered ${deduped.length} unique acts (from ${allEntries.length} entries)\n`);

  // Save index
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(deduped, null, 2));
  console.log(`  Index saved to ${INDEX_PATH}\n`);

  return deduped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Content — Fetch and parse each act
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndParseActs(acts: ActIndexEntry[], limit: number | null): Promise<void> {
  const toProcess = limit ? acts.slice(0, limit) : acts;
  console.log(`Phase 2: Fetching content for ${toProcess.length} acts...\n`);

  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;

  for (const act of toProcess) {
    const docId = buildDocumentId(act.title_en, act.title_th, act.beYear);
    const seedFile = path.join(SEED_DIR, `${docId}.json`);

    // Incremental: skip if seed already exists
    if (fs.existsSync(seedFile)) {
      skipped++;
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${failed} failed)`);
      }
      continue;
    }

    try {
      // Fetch Thai content
      const thaiResult = await fetchActPage(act.sysId);
      let thaiProvisions: ParsedAct['provisions'] = [];

      if (thaiResult.status === 200) {
        thaiProvisions = parseActContent(thaiResult.body, 'th');
      }

      // Try to fetch English translation
      const engResult = await fetchActEnglish(act.sysId);
      let engProvisions: ParsedAct['provisions'] = [];
      let titleEn = act.title_en;

      if (engResult.status === 200) {
        engProvisions = parseActContent(engResult.body, 'en');
        // Try to extract English title from the page
        if (!titleEn) {
          const titleMatch = engResult.body.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            titleEn = titleMatch[1].trim();
          }
        }
      }

      // Merge provisions (prefer English content where available, Thai as fallback)
      const mergedProvisions = mergeProvisions(thaiProvisions, engProvisions);

      const shortName = buildShortName(titleEn, act.title_th, act.ceYear);

      const parsed: ParsedAct = {
        id: docId,
        type: 'statute',
        title_th: act.title_th,
        title_en: titleEn,
        short_name: shortName,
        status: 'in_force',
        be_year: act.beYear,
        ce_year: act.ceYear,
        issued_date: `${act.ceYear}-01-01`,
        url: act.url,
        provisions: mergedProvisions,
      };

      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += mergedProvisions.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.sysId}: ${msg}`);
      failed++;
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${failed} failed, ${totalProvisions} provisions)`);
    }
  }

  console.log(`\nPhase 2 complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (already cached): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total provisions extracted: ${totalProvisions}`);
}

/**
 * Merge Thai and English provisions. Where both exist for the same section,
 * prefer English content (more useful for MCP consumers) but keep Thai as metadata.
 */
function mergeProvisions(
  thaiProvisions: ParsedAct['provisions'],
  engProvisions: ParsedAct['provisions'],
): ParsedAct['provisions'] {
  const bySection = new Map<string, ParsedAct['provisions'][0]>();

  // Add Thai provisions first
  for (const prov of thaiProvisions) {
    bySection.set(prov.section, prov);
  }

  // Overlay English provisions (preferred for content)
  for (const prov of engProvisions) {
    const existing = bySection.get(prov.section);
    if (existing) {
      bySection.set(prov.section, {
        ...existing,
        content: prov.content, // Use English content
        language: 'en',
      });
    } else {
      bySection.set(prov.section, prov);
    }
  }

  return Array.from(bySection.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, skipDiscovery } = parseArgs();

  console.log('Thailand Law MCP — Ingestion Pipeline');
  console.log('======================================\n');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipDiscovery) console.log(`  --skip-discovery`);
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

  console.log('\nIngestion complete.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
