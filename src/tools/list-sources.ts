/**
 * list_sources — Returns metadata about data sources, coverage, and freshness.
 *
 * Required by the Ansvar Law MCP standard tool set.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface ListSourcesResult {
  jurisdiction: string;
  sources: Array<{
    name: string;
    authority: string;
    url: string;
    license: string;
    coverage: string;
    languages: string[];
  }>;
  database: {
    tier: string;
    schema_version: string;
    built_at: string;
    document_count: number;
    provision_count: number;
    eu_document_count: number;
  };
  calendar_note: string;
  limitations: string[];
}

function safeCount(db: Database, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

function safeMetaValue(db: Database, key: string): string {
  try {
    const row = db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function listSources(db: Database): Promise<ToolResponse<ListSourcesResult>> {
  const documentCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents');
  const provisionCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions');
  const euDocumentCount = safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents');

  return {
    results: {
      jurisdiction: 'Thailand (TH)',
      sources: [
        {
          name: 'Office of the Council of State (Krisdika)',
          authority: 'Office of the Council of State, Kingdom of Thailand (สำนักงานคณะกรรมการกฤษฎีกา)',
          url: 'https://www.krisdika.go.th',
          license: 'Government Open Data',
          coverage: 'All Acts of Parliament (Phra Ratchabanyat), Royal Decrees, Ministerial Regulations, English translations for major statutes.',
          languages: ['th', 'en'],
        },
        {
          name: 'Royal Thai Government Gazette (Ratchakitcha)',
          authority: 'Cabinet Secretariat, Office of the Prime Minister',
          url: 'https://ratchakitcha.soc.go.th',
          license: 'Government Publication',
          coverage: 'Official Royal Thai Government Gazette. All legislation must be published here to take legal effect.',
          languages: ['th'],
        },
      ],
      database: {
        tier: safeMetaValue(db, 'tier'),
        schema_version: safeMetaValue(db, 'schema_version'),
        built_at: safeMetaValue(db, 'built_at'),
        document_count: documentCount,
        provision_count: provisionCount,
        eu_document_count: euDocumentCount,
      },
      calendar_note: 'Thailand uses the Buddhist Era (B.E.) calendar for legislation. B.E. year = CE year + 543. Example: 2019 CE = B.E. 2562.',
      limitations: [
        `Covers ${documentCount.toLocaleString()} Thai statutes. Subsidiary legislation is not yet fully indexed.`,
        'Thai is the legally binding language; English translations are unofficial and may contain inaccuracies.',
        'English translations may lag behind Thai originals for recently amended provisions.',
        'EU/international cross-references are curated for key acts (PDPA, Cybersecurity Act) — not auto-extracted.',
        'Historical legislation before digitisation on Krisdika may be incomplete.',
        'Always verify against official Royal Gazette publications when legal certainty is required.',
      ],
    },
    _metadata: generateResponseMetadata(db),
  };
}
