#!/usr/bin/env tsx
/**
 * Thailand Law MCP — Ingestion Pipeline
 *
 * Two-phase ingestion of Thai legislation from searchlaw.ocs.go.th public API:
 *
 *   Phase 1 (Discovery): List all laws via searchByYear (4,300+ laws)
 *   Phase 2 (Content):   Fetch full structured text via getLawDoc
 *
 * Usage:
 *   npm run ingest                    # Full ingestion (discovery + content)
 *   npm run ingest -- --limit 20      # Test with 20 acts
 *   npm run ingest -- --skip-discovery # Reuse cached act index
 *   npm run ingest -- --resume        # Skip already-cached seed files
 *   npm run ingest -- --acts-only     # Only Acts (พ.ร.บ.), Codes, Constitution
 *
 * Data is sourced from the Office of the Council of State (government open data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  discoverAllLaws,
  discoverEnglishLaws,
  getLawDoc,
  getLawHtml,
  type BrowseEntry,
  type LawSection,
} from './lib/fetcher.js';
import {
  buildDocumentId,
  buildShortName,
  parseActContent,
  beToce,
  type ActIndexEntry,
  type ParsedAct,
  type ParsedProvision,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_PATH = path.join(SOURCE_DIR, 'act-index.json');

// Primary legislation category IDs from the OCS config
const PRIMARY_CATEGORIES = new Set([
  '10',   // Constitution
  '1A',   // Organic Acts
  '1B',   // Acts (พระราชบัญญัติ)
  '1C',   // Emergency Decrees
  '1D',   // Codes (ประมวลกฎหมาย)
]);

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): {
  limit: number | null;
  skipDiscovery: boolean;
  resume: boolean;
  actsOnly: boolean;
  refetchEmpty: boolean;
} {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipDiscovery = false;
  let resume = false;
  let actsOnly = false;
  let refetchEmpty = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-discovery') {
      skipDiscovery = true;
    } else if (args[i] === '--resume') {
      resume = true;
    } else if (args[i] === '--acts-only') {
      actsOnly = true;
    } else if (args[i] === '--refetch-empty') {
      refetchEmpty = true;
    }
  }

  return { limit, skipDiscovery, resume, actsOnly, refetchEmpty };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML stripping
// ─────────────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery — List all laws via searchByYear
// ─────────────────────────────────────────────────────────────────────────────

async function discoverActs(actsOnly: boolean): Promise<ActIndexEntry[]> {
  console.log('Phase 1: Discovering Thai legislation via searchByYear API...\n');

  const allLaws = await discoverAllLaws();
  console.log(`  Total laws from API: ${allLaws.length}\n`);

  // Fetch English translations
  process.stdout.write('  Fetching English translations...');
  const engLaws = await discoverEnglishLaws();
  console.log(` ${engLaws.length} English translations found`);

  // Build English title lookup by timelineId
  const engByTimeline = new Map<string, string>();
  for (const eng of engLaws) {
    if (eng.headerEn || eng.header) {
      engByTimeline.set(eng.timelineId, eng.headerEn ?? eng.header);
    }
  }

  // Filter by category if --acts-only
  const filtered = actsOnly
    ? allLaws.filter(l => PRIMARY_CATEGORIES.has(l.lawCategoryId))
    : allLaws;

  if (actsOnly) {
    console.log(`  Filtered to primary legislation: ${filtered.length} laws`);
  }

  // Convert to ActIndexEntry format
  const entries: ActIndexEntry[] = [];
  for (const law of filtered) {
    const ceYear = law.yearAd;
    const beYear = ceYear + 543;

    entries.push({
      title_th: law.header,
      title_en: engByTimeline.get(law.timelineId) ?? '',
      sysId: law.timelineId,
      beYear,
      ceYear,
      url: `https://searchlaw.ocs.go.th/council-of-state/#/public/doc/${law.timelineId}`,
      category: law.lawCategoryId,
    });
  }

  // Deduplicate by timelineId
  const seen = new Set<string>();
  const deduped: ActIndexEntry[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.sysId)) {
      seen.add(entry.sysId);
      deduped.push(entry);
    }
  }

  console.log(`\n  Discovered ${deduped.length} unique laws\n`);

  // Save index
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(deduped, null, 2));
  console.log(`  Index saved to ${INDEX_PATH}\n`);

  return deduped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Content — Fetch full text via getLawDoc
// ─────────────────────────────────────────────────────────────────────────────

function parseSections(sections: LawSection[]): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  for (const s of sections) {
    // sectionTypeId 4 = article/section (มาตรา), the primary provision type
    // Also capture: 3=preamble, 13=schedule, 15=note
    // API returns sectionTypeId as string, so coerce to number
    const typeId = Number(s.sectionTypeId);
    if (![3, 4, 13, 15].includes(typeId)) continue;
    if (!s.sectionContent || s.sectionContent.trim().length === 0) continue;

    const content = stripHtml(s.sectionContent);
    if (content.length === 0) continue;

    const sectionNum = s.sectionNo || String(s.orderNo);
    const label = s.sectionLabel || `มาตรา ${sectionNum}`;

    provisions.push({
      provision_ref: typeId === 4 ? `s${sectionNum}` : `sch-${sectionNum}`,
      section: sectionNum,
      title: label,
      content,
      language: 'th',
    });
  }

  return provisions;
}

async function fetchAndParseActs(
  acts: ActIndexEntry[],
  limit: number | null,
  resume: boolean,
  refetchEmpty: boolean,
): Promise<void> {
  const toProcess = limit ? acts.slice(0, limit) : acts;
  console.log(`Phase 2: Fetching full text for ${toProcess.length} laws...\n`);

  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let fetched = 0;
  let failed = 0;
  let htmlFallback = 0;
  let totalProvisions = 0;

  for (const act of toProcess) {
    const docId = buildDocumentId(act.title_en, act.title_th, act.beYear, act.sysId);
    const seedFile = path.join(SEED_DIR, `${docId}.json`);

    // Resume mode: skip if seed file exists and has provisions
    if (resume && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        const provCount = (existing.provisions ?? []).length;
        if (provCount > 0 && !refetchEmpty) {
          totalProvisions += provCount;
          skipped++;
          processed++;
          if (processed % 100 === 0) {
            process.stdout.write(`\r  Progress: ${processed}/${toProcess.length} (${fetched} fetched, ${skipped} skipped, ${failed} failed)`);
          }
          continue;
        }
        // refetchEmpty mode: re-fetch if provisions are empty
        if (provCount > 0 && refetchEmpty) {
          totalProvisions += provCount;
          skipped++;
          processed++;
          continue;
        }
        // provCount === 0 → fall through to re-fetch
      } catch {
        // corrupt file — re-fetch
      }
    }

    // Fetch full text from API
    let provisions: ParsedProvision[] = [];
    try {
      const doc = await getLawDoc(act.sysId);
      if (doc?.lawSections && doc.lawSections.length > 0) {
        provisions = parseSections(doc.lawSections);
      }

      // Fallback: if getLawDoc returned no sections, try printHtml
      if (provisions.length === 0) {
        try {
          const html = await getLawHtml(act.sysId);
          if (html && html.length > 100) {
            provisions = parseActContent(html, 'th');
            if (provisions.length > 0) {
              htmlFallback++;
            }
          }
        } catch {
          // printHtml fallback failed — continue with empty provisions
        }
      }
    } catch (err) {
      console.log(`\n  ERROR fetching ${docId}: ${err}`);
      failed++;
    }

    // Determine status
    let status: 'in_force' | 'amended' | 'repealed' = 'in_force';
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
      provisions,
    };

    fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
    totalProvisions += provisions.length;
    fetched++;
    processed++;

    if (processed % 50 === 0) {
      process.stdout.write(`\r  Progress: ${processed}/${toProcess.length} (${fetched} fetched, ${skipped} skipped, ${failed} failed, ${totalProvisions} provisions)`);
    }
  }

  console.log(`\n\nPhase 2 complete:`);
  console.log(`  Total processed: ${toProcess.length}`);
  console.log(`  Fetched from API: ${fetched}`);
  console.log(`  Skipped (resume): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  HTML fallback rescues: ${htmlFallback}`);
  console.log(`  Total provisions: ${totalProvisions}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Re-fetch empty seeds (bypass broken discovery pagination)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-fetch seeds that exist but have 0 provisions.
 * Extracts timelineId from the OCS URL in each seed, then tries getLawDoc + printHtml.
 * This bypasses the broken searchByYear pagination (stuck at 500/4337).
 */
async function refetchEmptySeeds(limit: number | null): Promise<void> {
  const seedFiles = fs.readdirSync(SEED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'));

  const emptySeedPaths: Array<{ file: string; timelineId: string; data: ParsedAct }> = [];

  for (const file of seedFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8')) as ParsedAct;
      if ((data.provisions ?? []).length > 0) continue;

      // Extract timelineId from OCS URL
      const url = data.url ?? '';
      const docPart = url.split('/doc/');
      if (docPart.length < 2) continue;
      const timelineId = docPart[1].trim();
      if (!timelineId) continue;

      emptySeedPaths.push({ file, timelineId, data });
    } catch {
      // corrupt file — skip
    }
  }

  const toProcess = limit ? emptySeedPaths.slice(0, limit) : emptySeedPaths;
  console.log(`Phase 3: Re-fetching ${toProcess.length} empty seeds (of ${emptySeedPaths.length} total empty)...\n`);

  let rescued = 0;
  let htmlRescued = 0;
  let stillEmpty = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const { file, timelineId, data } = toProcess[i];

    try {
      let provisions: ParsedProvision[] = [];

      // Try getLawDoc first
      const doc = await getLawDoc(timelineId);
      if (doc?.lawSections && doc.lawSections.length > 0) {
        provisions = parseSections(doc.lawSections);
      }

      // Fallback: try printHtml
      if (provisions.length === 0) {
        try {
          const html = await getLawHtml(timelineId);
          if (html && html.length > 100) {
            provisions = parseActContent(html, 'th');
            if (provisions.length > 0) htmlRescued++;
          }
        } catch {
          // printHtml fallback failed
        }
      }

      if (provisions.length > 0) {
        data.provisions = provisions;
        // Update the ID to include sysId suffix for uniqueness
        const newId = buildDocumentId(data.title_en, data.title_th, data.be_year, timelineId);
        const oldId = data.id;
        data.id = newId;

        // Write updated seed (potentially with new filename)
        const newFile = `${newId}.json`;
        fs.writeFileSync(path.join(SEED_DIR, newFile), JSON.stringify(data, null, 2));
        // Remove old file if name changed
        if (newFile !== file) {
          fs.unlinkSync(path.join(SEED_DIR, file));
        }
        rescued++;
      } else {
        stillEmpty++;
      }
    } catch (err) {
      console.log(`\n  ERROR re-fetching ${file}: ${err}`);
      failed++;
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${toProcess.length} (rescued: ${rescued}, HTML: ${htmlRescued}, empty: ${stillEmpty}, failed: ${failed})`);
    }
  }

  console.log(`\n\nPhase 3 complete:`);
  console.log(`  Processed: ${toProcess.length}`);
  console.log(`  Rescued (getLawDoc): ${rescued - htmlRescued}`);
  console.log(`  Rescued (printHtml): ${htmlRescued}`);
  console.log(`  Still empty: ${stillEmpty}`);
  console.log(`  Failed: ${failed}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, skipDiscovery, resume, actsOnly, refetchEmpty } = parseArgs();

  console.log('Thailand Law MCP — Ingestion Pipeline (v2 — OCS Public API)');
  console.log('============================================================\n');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipDiscovery) console.log(`  --skip-discovery`);
  if (resume) console.log(`  --resume`);
  if (actsOnly) console.log(`  --acts-only (primary legislation only)`);
  if (refetchEmpty) console.log(`  --refetch-empty (re-fetch seeds with 0 provisions)`);
  console.log('');

  if (refetchEmpty) {
    // Dedicated mode: only re-fetch empty seeds, skip discovery
    await refetchEmptySeeds(limit);
  } else {
    let acts: ActIndexEntry[];

    if (skipDiscovery && fs.existsSync(INDEX_PATH)) {
      console.log(`Using cached act index from ${INDEX_PATH}\n`);
      acts = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
      console.log(`  ${acts.length} acts in index\n`);
    } else {
      acts = await discoverActs(actsOnly);
    }

    await fetchAndParseActs(acts, limit, resume, refetchEmpty);
  }

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

  console.log(`\n=== Ingestion Summary ===`);
  console.log(`  Total documents: ${totalDocs}`);
  console.log(`  Documents with provisions: ${docsWithProvisions}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log('\nNext step: npm run build:db');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
