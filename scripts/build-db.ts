#!/usr/bin/env tsx
/**
 * Database builder for Thailand Law MCP server.
 *
 * Builds the SQLite database from seed JSON files in data/seed/.
 * Includes Thailand-specific metadata: B.E. year, CE year, language columns.
 *
 * Usage: npm run build:db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const DB_PATH = path.resolve(__dirname, '../data/database.db');

// ─────────────────────────────────────────────────────────────────────────────
// Seed file types
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentSeed {
  id: string;
  type: 'statute';
  title_th: string;
  title_en: string;
  short_name?: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  be_year: number;
  ce_year: number;
  issued_date?: string;
  in_force_date?: string;
  url?: string;
  description?: string;
  provisions?: ProvisionSeed[];
}

interface ProvisionSeed {
  provision_ref: string;
  chapter?: string;
  section: string;
  title?: string;
  content: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

interface ProvisionDedupStats {
  duplicate_refs: number;
  conflicting_duplicates: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// EU references for known Thai laws
// ─────────────────────────────────────────────────────────────────────────────

interface EUReferenceSeed {
  eu_document_id: string;
  eu_type: 'directive' | 'regulation';
  eu_year: number;
  eu_number: number;
  eu_community: string;
  eu_title: string;
  eu_short_name: string;
  eu_url: string;
  reference_type: string;
  is_primary: boolean;
  context: string;
}

/** Curated international references for key Thai statutes */
const KNOWN_EU_REFERENCES: Record<string, EUReferenceSeed[]> = {
  'pdpa-be2562': [
    {
      eu_document_id: 'regulation:2016/679',
      eu_type: 'regulation',
      eu_year: 2016,
      eu_number: 679,
      eu_community: 'EU',
      eu_title: 'General Data Protection Regulation (GDPR)',
      eu_short_name: 'GDPR',
      eu_url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
      reference_type: 'modeled_on',
      is_primary: true,
      context: 'Thailand PDPA was modeled on the EU GDPR. Core concepts including lawful bases for processing, data subject rights, and data protection officer requirements are substantially derived from GDPR provisions.',
    },
  ],
  'csa-be2562': [
    {
      eu_document_id: 'directive:2016/1148',
      eu_type: 'directive',
      eu_year: 2016,
      eu_number: 1148,
      eu_community: 'EU',
      eu_title: 'Directive on security of network and information systems (NIS Directive)',
      eu_short_name: 'NIS Directive',
      eu_url: 'https://eur-lex.europa.eu/eli/dir/2016/1148/oj',
      reference_type: 'references',
      is_primary: false,
      context: 'Thailand Cybersecurity Act draws from international cybersecurity frameworks including the EU NIS Directive and ASEAN cybersecurity cooperation frameworks for critical information infrastructure protection.',
    },
  ],
  'cca-be2550': [
    {
      eu_document_id: 'directive:2013/40',
      eu_type: 'directive',
      eu_year: 2013,
      eu_number: 40,
      eu_community: 'EU',
      eu_title: 'Directive on attacks against information systems',
      eu_short_name: 'Cyber Attacks Directive',
      eu_url: 'https://eur-lex.europa.eu/eli/dir/2013/40/oj',
      reference_type: 'references',
      is_primary: false,
      context: 'Thailand Computer Crime Act addresses similar subject matter as the EU Directive on attacks against information systems, criminalising unauthorised computer access and data interference.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Database schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
-- Legal documents (statutes)
CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('statute', 'royal_decree', 'ministerial_regulation')),
  title TEXT NOT NULL,
  title_en TEXT,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK(status IN ('in_force', 'amended', 'repealed', 'not_yet_in_force')),
  be_year INTEGER,
  ce_year INTEGER,
  issued_date TEXT,
  in_force_date TEXT,
  url TEXT,
  description TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

-- Individual provisions from statutes
CREATE TABLE legal_provisions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_ref TEXT NOT NULL,
  chapter TEXT,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  metadata TEXT,
  UNIQUE(document_id, provision_ref)
);

CREATE INDEX idx_provisions_doc ON legal_provisions(document_id);
CREATE INDEX idx_provisions_chapter ON legal_provisions(document_id, chapter);

-- FTS5 for provision search (supports Thai Unicode via unicode61 tokenizer)
CREATE VIRTUAL TABLE provisions_fts USING fts5(
  content, title,
  content='legal_provisions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER provisions_ai AFTER INSERT ON legal_provisions BEGIN
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

CREATE TRIGGER provisions_ad AFTER DELETE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
END;

CREATE TRIGGER provisions_au AFTER UPDATE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

-- Cross-references between provisions/documents
CREATE TABLE cross_references (
  id INTEGER PRIMARY KEY,
  source_document_id TEXT NOT NULL REFERENCES legal_documents(id),
  source_provision_ref TEXT,
  target_document_id TEXT NOT NULL REFERENCES legal_documents(id),
  target_provision_ref TEXT,
  ref_type TEXT NOT NULL DEFAULT 'references'
    CHECK(ref_type IN ('references', 'amended_by', 'implements', 'see_also'))
);

CREATE INDEX idx_xref_source ON cross_references(source_document_id);
CREATE INDEX idx_xref_target ON cross_references(target_document_id);

-- Legal term definitions
CREATE TABLE definitions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  term TEXT NOT NULL,
  term_en TEXT,
  definition TEXT NOT NULL,
  source_provision TEXT,
  UNIQUE(document_id, term)
);

-- FTS5 for definition search
CREATE VIRTUAL TABLE definitions_fts USING fts5(
  term, definition,
  content='definitions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER definitions_ai AFTER INSERT ON definitions BEGIN
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

CREATE TRIGGER definitions_ad AFTER DELETE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
END;

CREATE TRIGGER definitions_au AFTER UPDATE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

-- =============================================================================
-- EU / INTERNATIONAL REFERENCES SCHEMA
-- =============================================================================

-- EU Documents (directives and regulations)
CREATE TABLE eu_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('directive', 'regulation')),
  year INTEGER NOT NULL CHECK (year >= 1957 AND year <= 2100),
  number INTEGER NOT NULL CHECK (number > 0),
  community TEXT CHECK (community IN ('EU', 'EC', 'EEC', 'Euratom')),
  celex_number TEXT,
  title TEXT,
  title_en TEXT,
  short_name TEXT,
  adoption_date TEXT,
  entry_into_force_date TEXT,
  in_force BOOLEAN DEFAULT 1,
  amended_by TEXT,
  repeals TEXT,
  url_eur_lex TEXT,
  description TEXT,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eu_documents_type_year ON eu_documents(type, year DESC);
CREATE INDEX idx_eu_documents_celex ON eu_documents(celex_number);

-- EU References (links national provisions to EU/international documents)
CREATE TABLE eu_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('provision', 'document', 'case_law')),
  source_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_id INTEGER REFERENCES legal_provisions(id),
  eu_document_id TEXT NOT NULL REFERENCES eu_documents(id),
  eu_article TEXT,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'implements', 'supplements', 'applies', 'references', 'complies_with',
    'derogates_from', 'amended_by', 'repealed_by', 'cites_article', 'modeled_on'
  )),
  reference_context TEXT,
  full_citation TEXT,
  is_primary_implementation BOOLEAN DEFAULT 0,
  implementation_status TEXT CHECK (implementation_status IN ('complete', 'partial', 'pending', 'unknown')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_verified TEXT,
  UNIQUE(source_id, eu_document_id, eu_article)
);

CREATE INDEX idx_eu_references_document ON eu_references(document_id, eu_document_id);
CREATE INDEX idx_eu_references_eu_document ON eu_references(eu_document_id, document_id);
CREATE INDEX idx_eu_references_provision ON eu_references(provision_id, eu_document_id);

-- Build metadata (tier, schema version, build timestamp)
CREATE TABLE db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pickPreferredProvision(existing: ProvisionSeed, incoming: ProvisionSeed): ProvisionSeed {
  const existingContent = normalizeWhitespace(existing.content);
  const incomingContent = normalizeWhitespace(incoming.content);

  if (incomingContent.length > existingContent.length) {
    return {
      ...incoming,
      title: incoming.title ?? existing.title,
    };
  }

  return {
    ...existing,
    title: existing.title ?? incoming.title,
  };
}

function dedupeProvisions(provisions: ProvisionSeed[]): { deduped: ProvisionSeed[]; stats: ProvisionDedupStats } {
  const byRef = new Map<string, ProvisionSeed>();
  const stats: ProvisionDedupStats = {
    duplicate_refs: 0,
    conflicting_duplicates: 0,
  };

  for (const provision of provisions) {
    const ref = provision.provision_ref.trim();
    const existing = byRef.get(ref);

    if (!existing) {
      byRef.set(ref, { ...provision, provision_ref: ref });
      continue;
    }

    stats.duplicate_refs++;

    const existingContent = normalizeWhitespace(existing.content);
    const incomingContent = normalizeWhitespace(provision.content);

    if (existingContent !== incomingContent) {
      stats.conflicting_duplicates++;
    }

    byRef.set(ref, pickPreferredProvision(existing, provision));
  }

  return {
    deduped: Array.from(byRef.values()),
    stats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

function buildDatabase(): void {
  console.log('Building Thailand Law MCP database...\n');

  // Delete existing database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('  Deleted existing database.\n');
  }

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(SCHEMA);

  // Prepared statements
  const insertDoc = db.prepare(`
    INSERT INTO legal_documents (id, type, title, title_en, short_name, status, be_year, ce_year, issued_date, in_force_date, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProvision = db.prepare(`
    INSERT INTO legal_provisions (document_id, provision_ref, chapter, section, title, content, language, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEuDocument = db.prepare(`
    INSERT OR IGNORE INTO eu_documents
      (id, type, year, number, community, title, short_name, url_eur_lex, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEuReference = db.prepare(`
    INSERT INTO eu_references
      (
        source_type, source_id, document_id, provision_id, eu_document_id, eu_article,
        reference_type, reference_context, full_citation, is_primary_implementation,
        implementation_status, last_verified
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Load seed files
  if (!fs.existsSync(SEED_DIR)) {
    console.log(`No seed directory at ${SEED_DIR} — creating empty database.`);
  }

  const seedFiles = fs.existsSync(SEED_DIR)
    ? fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'))
    : [];

  let totalDocs = 0;
  let totalProvisions = 0;
  let totalDuplicateRefs = 0;
  let totalConflictingDuplicates = 0;
  let emptyDocs = 0;
  let totalEuDocuments = 0;
  let totalEuReferences = 0;

  const loadAll = db.transaction(() => {
    for (const file of seedFiles) {
      const filePath = path.join(SEED_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const seed = JSON.parse(content) as DocumentSeed;

      insertDoc.run(
        seed.id,
        seed.type ?? 'statute',
        seed.title_th ?? seed.id,
        seed.title_en ?? null,
        seed.short_name ?? null,
        seed.status ?? 'in_force',
        seed.be_year ?? null,
        seed.ce_year ?? null,
        seed.issued_date ?? null,
        seed.in_force_date ?? null,
        seed.url ?? null,
        seed.description ?? null,
      );
      totalDocs++;

      if (!seed.provisions || seed.provisions.length === 0) {
        emptyDocs++;
        continue;
      }

      const { deduped, stats } = dedupeProvisions(seed.provisions);
      totalDuplicateRefs += stats.duplicate_refs;
      totalConflictingDuplicates += stats.conflicting_duplicates;
      if (stats.duplicate_refs > 0) {
        console.log(
          `    WARNING: ${stats.duplicate_refs} duplicate refs in ${seed.id} ` +
          `(${stats.conflicting_duplicates} with different text).`
        );
      }

      for (const prov of deduped) {
        insertProvision.run(
          seed.id,
          prov.provision_ref,
          prov.chapter ?? null,
          prov.section,
          prov.title ?? null,
          prov.content,
          prov.language ?? 'en',
          prov.metadata ? JSON.stringify(prov.metadata) : null,
        );
        totalProvisions++;
      }

      // Insert curated EU references for this document
      const euRefs = KNOWN_EU_REFERENCES[seed.id];
      if (euRefs) {
        const lastVerified = new Date().toISOString();
        for (const ref of euRefs) {
          const euInsert = insertEuDocument.run(
            ref.eu_document_id,
            ref.eu_type,
            ref.eu_year,
            ref.eu_number,
            ref.eu_community,
            ref.eu_title,
            ref.eu_short_name,
            ref.eu_url,
            ref.context,
          );
          if (euInsert.changes > 0) {
            totalEuDocuments++;
          }

          try {
            const refInsert = insertEuReference.run(
              'document',
              seed.id,
              seed.id,
              null,
              ref.eu_document_id,
              null,
              ref.reference_type,
              ref.context,
              `${ref.eu_short_name} (${ref.eu_document_id})`,
              ref.is_primary ? 1 : 0,
              ref.is_primary ? 'complete' : 'unknown',
              lastVerified,
            );
            if (refInsert.changes > 0) {
              totalEuReferences++;
            }
          } catch {
            // Ignore duplicate references
          }
        }
      }
    }
  });

  loadAll();

  // Write build metadata
  const insertMeta = db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
  const writeMeta = db.transaction(() => {
    insertMeta.run('tier', 'free');
    insertMeta.run('schema_version', '2');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('builder', 'build-db.ts');
    insertMeta.run('jurisdiction', 'TH');
    insertMeta.run('source', 'krisdika.go.th');
    insertMeta.run('licence', 'Government Open Data');
    insertMeta.run('calendar', 'Buddhist Era (B.E.)');
  });
  writeMeta();

  // CRITICAL: Set journal_mode to DELETE for WASM compatibility
  db.pragma('journal_mode = DELETE');

  db.exec('ANALYZE');
  db.exec('VACUUM');
  db.close();

  const size = fs.statSync(DB_PATH).size;
  console.log(
    `\nBuild complete: ${totalDocs} documents, ${totalProvisions} provisions, ` +
    `${totalEuDocuments} EU documents, ${totalEuReferences} EU references`
  );
  if (emptyDocs > 0) {
    console.log(`  ${emptyDocs} documents with no provisions.`);
  }
  if (totalDuplicateRefs > 0) {
    console.log(
      `Data quality: ${totalDuplicateRefs} duplicate refs detected ` +
      `(${totalConflictingDuplicates} with conflicting text).`
    );
  }
  console.log(`Output: ${DB_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

buildDatabase();
