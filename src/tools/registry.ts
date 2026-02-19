/**
 * Tool registry for Thailand Law MCP Server.
 * Shared between stdio (index.ts) and HTTP (api/mcp.ts) entry points.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';

import { searchLegislation, SearchLegislationInput } from './search-legislation.js';
import { getProvision, GetProvisionInput } from './get-provision.js';
import { listSources } from './list-sources.js';
import { validateCitationTool, ValidateCitationInput } from './validate-citation.js';
import { buildLegalStance, BuildLegalStanceInput } from './build-legal-stance.js';
import { formatCitationTool, FormatCitationInput } from './format-citation.js';
import { checkCurrency, CheckCurrencyInput } from './check-currency.js';
import { getEUBasis, GetEUBasisInput } from './get-eu-basis.js';
import { getThaiImplementations, GetThaiImplementationsInput } from './get-thai-implementations.js';
import { searchEUImplementations, SearchEUImplementationsInput } from './search-eu-implementations.js';
import { getProvisionEUBasis, GetProvisionEUBasisInput } from './get-provision-eu-basis.js';
import { validateEUCompliance, ValidateEUComplianceInput } from './validate-eu-compliance.js';
import { getAbout, type AboutContext } from './about.js';
export type { AboutContext } from './about.js';

const ABOUT_TOOL: Tool = {
  name: 'about',
  description:
    'Server metadata, dataset statistics, freshness, and provenance. ' +
    'Call this to verify data coverage, currency, and content basis before relying on results.',
  inputSchema: { type: 'object', properties: {} },
};

export const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Search Thai statutes and regulations by keyword (Thai or English). Returns provision-level results with BM25 relevance ranking. ' +
      'Supports natural language queries (e.g., "personal data protection") and FTS5 syntax (AND, OR, NOT, "phrase", prefix*). ' +
      'Results include: document ID, title, provision reference, snippet with >>>highlight<<< markers, and relevance score. ' +
      'Use document_id to filter within a single statute. Use status to filter by in_force/amended/repealed. ' +
      'Default limit is 10 (max 50). For broad legal research, prefer build_legal_stance instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in Thai or English. Supports natural language or FTS5 syntax (AND, OR, NOT, "phrase", prefix*). Example: "personal data" OR "data controller"',
        },
        document_id: {
          type: 'string',
          description: 'Filter to a specific statute by ID (e.g., "pdpa-be2562") or title (e.g., "Personal Data Protection Act")',
        },
        status: {
          type: 'string',
          enum: ['in_force', 'amended', 'repealed'],
          description: 'Filter by legislative status. Omit to search all statuses.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 50). Lower values save tokens.',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provision',
    description:
      'Retrieve the full text of a specific provision (section/มาตรา) from a Thai statute, or all provisions for a statute if no section is specified. ' +
      'Thai provisions use section notation: s3, s3(1). Pass document_id as either the internal ID (e.g., "pdpa-be2562") ' +
      'or the human-readable title (e.g., "Personal Data Protection Act B.E. 2562"). ' +
      'Returns: document ID, title, status, provision reference, chapter, section, title, and full content text. ' +
      'WARNING: Omitting section/provision_ref returns ALL provisions (capped at 200) for the statute. ' +
      'Note: Thailand uses Buddhist Era (B.E.) dating — B.E. 2562 = 2019 CE.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Statute identifier (e.g., "pdpa-be2562") or title (e.g., "Personal Data Protection Act B.E. 2562"). Fuzzy title matching is supported.',
        },
        section: {
          type: 'string',
          description: 'Section number (e.g., "3", "1(1)"). Matched against provision_ref and section columns.',
        },
        provision_ref: {
          type: 'string',
          description: 'Direct provision reference (e.g., "s1(1)", "s3"). Takes precedence over section if both provided.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'list_sources',
    description:
      'Returns metadata about all data sources backing this server, including jurisdiction (Thailand), ' +
      'source details (Krisdika, Royal Gazette), database tier, schema version, build date, record counts, ' +
      'Buddhist Era calendar note, and known limitations. ' +
      'Call this first to understand data coverage and freshness before relying on other tools.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validate_citation',
    description:
      'Validate a Thai legal citation against the database. Returns whether the cited statute and provision exist. ' +
      'Use this as a zero-hallucination check before presenting legal references to users. ' +
      'Supported formats: "Section 3, Personal Data Protection Act B.E. 2562", "s. 3 PDPA 2019", ' +
      '"มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562". ' +
      'Returns: valid (boolean), parsed components, warnings about repealed/amended status.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Thai legal citation to validate. Accepts Thai or English format. Examples: "Section 3, Personal Data Protection Act B.E. 2562", "s. 3 PDPA 2019"',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive set of citations for a legal question by searching across all Thai statutes simultaneously. ' +
      'Returns aggregated results from legislation search, cross-referenced with international law where applicable. ' +
      'Best for broad legal research questions like "What Thai laws govern personal data processing?" ' +
      'For targeted lookups of a known provision, use get_provision instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legal question or topic to research (e.g., "personal data processing obligations")',
        },
        document_id: {
          type: 'string',
          description: 'Optionally limit search to one statute by ID or title',
        },
        limit: {
          type: 'number',
          description: 'Max results per category (default: 5, max: 20)',
          default: 5,
          minimum: 1,
          maximum: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'format_citation',
    description:
      'Format a Thai legal citation per standard conventions. ' +
      'Formats: "full_th" → "มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562", ' +
      '"full_en" → "Section 3, Personal Data Protection Act B.E. 2562 (2019)", ' +
      '"short" → "s. 3, PDPA 2019", "pinpoint" → "s. 3". ' +
      'Does NOT validate existence — use validate_citation for that.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Citation string to format (e.g., "Personal Data Protection Act B.E. 2562, s. 3")',
        },
        format: {
          type: 'string',
          enum: ['full_th', 'full_en', 'short', 'pinpoint'],
          description: 'Output format. "full_en" (default): formal English citation with B.E. year. "full_th": Thai format. "short": abbreviated. "pinpoint": section reference only.',
          default: 'full_en',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'check_currency',
    description:
      'Check whether a Thai statute or provision is currently in force, amended, or repealed. ' +
      'Returns: is_current (boolean), status, B.E. year, CE year, dates, and warnings. ' +
      'Essential before citing legislation — repealed acts should not be cited as current law.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Statute identifier (e.g., "pdpa-be2562") or title (e.g., "Personal Data Protection Act B.E. 2562")',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional provision reference to check a specific section (e.g., "s3")',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_eu_basis',
    description:
      'Get international legal basis (EU directives, regulations, ASEAN frameworks) for a Thai statute. ' +
      'Returns all international instruments that the Thai statute is modeled on, implements, or references. ' +
      'Useful for understanding the GDPR basis of the PDPA or the NIS basis of the Cybersecurity Act. ' +
      'Example: PDPA B.E. 2562 → modeled on GDPR (Regulation 2016/679).',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Thai statute identifier (e.g., "pdpa-be2562") or title (e.g., "Personal Data Protection Act B.E. 2562")',
        },
        include_articles: {
          type: 'boolean',
          description: 'Include specific EU article references in the response (default: false)',
          default: false,
        },
        reference_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['implements', 'supplements', 'applies', 'references', 'complies_with', 'modeled_on', 'derogates_from', 'amended_by', 'repealed_by', 'cites_article'],
          },
          description: 'Filter by reference type (e.g., ["modeled_on"]). Omit to return all types.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_thai_implementations',
    description:
      'Find Thai statutes that implement or are modeled on a specific EU directive or regulation. ' +
      'Input the EU document ID in "type:year/number" format (e.g., "regulation:2016/679" for GDPR). ' +
      'Returns matching Thai statutes with implementation status and relationship type.',
    inputSchema: {
      type: 'object',
      properties: {
        eu_document_id: {
          type: 'string',
          description: 'EU document ID in format "type:year/number" (e.g., "regulation:2016/679" for GDPR, "directive:2016/1148" for NIS Directive)',
        },
        primary_only: {
          type: 'boolean',
          description: 'Return only primary implementing statutes (default: false)',
          default: false,
        },
        in_force_only: {
          type: 'boolean',
          description: 'Return only statutes currently in force (default: false)',
          default: false,
        },
      },
      required: ['eu_document_id'],
    },
  },
  {
    name: 'search_eu_implementations',
    description:
      'Search for EU directives and regulations that have been implemented or referenced by Thai statutes. ' +
      'Search by keyword (e.g., "data protection", "cybersecurity"), filter by type (directive/regulation), ' +
      'or year range. Returns EU documents with counts of Thai statutes referencing them.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword search across EU document titles and short names (e.g., "data protection")',
        },
        type: {
          type: 'string',
          enum: ['directive', 'regulation'],
          description: 'Filter by EU document type',
        },
        year_from: { type: 'number', description: 'Filter: EU documents from this year onwards' },
        year_to: { type: 'number', description: 'Filter: EU documents up to this year' },
        has_thai_implementation: {
          type: 'boolean',
          description: 'If true, only return EU documents that have at least one Thai implementing statute',
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 20, max: 100)',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'get_provision_eu_basis',
    description:
      'Get international legal basis for a specific provision within a Thai statute, with article-level precision. ' +
      'Example: PDPA s19 → modeled on GDPR Article 6. ' +
      'Use this for pinpoint international compliance checks at the provision level.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Thai statute identifier (e.g., "pdpa-be2562") or title',
        },
        provision_ref: {
          type: 'string',
          description: 'Provision reference (e.g., "s3", "s1(1)")',
        },
      },
      required: ['document_id', 'provision_ref'],
    },
  },
  {
    name: 'validate_eu_compliance',
    description:
      'Check international compliance status for a Thai statute or provision. Detects references to international instruments, ' +
      'GDPR alignment, and ASEAN framework compliance. Returns compliance status: compliant, partial, unclear, or not_applicable. ' +
      'Note: This is Phase 1 validation. Full compliance checking will be expanded in future releases.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Thai statute identifier (e.g., "pdpa-be2562") or title',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional: check a specific provision (e.g., "s3")',
        },
        eu_document_id: {
          type: 'string',
          description: 'Optional: check compliance with a specific EU document (e.g., "regulation:2016/679")',
        },
      },
      required: ['document_id'],
    },
  },
];

export function buildTools(context?: AboutContext): Tool[] {
  return context ? [...TOOLS, ABOUT_TOOL] : TOOLS;
}

export function registerTools(
  server: Server,
  db: InstanceType<typeof Database>,
  context?: AboutContext,
): void {
  const allTools = buildTools(context);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_legislation':
          result = await searchLegislation(db, args as unknown as SearchLegislationInput);
          break;
        case 'get_provision':
          result = await getProvision(db, args as unknown as GetProvisionInput);
          break;
        case 'list_sources':
          result = await listSources(db);
          break;
        case 'validate_citation':
          result = await validateCitationTool(db, args as unknown as ValidateCitationInput);
          break;
        case 'build_legal_stance':
          result = await buildLegalStance(db, args as unknown as BuildLegalStanceInput);
          break;
        case 'format_citation':
          result = await formatCitationTool(args as unknown as FormatCitationInput);
          break;
        case 'check_currency':
          result = await checkCurrency(db, args as unknown as CheckCurrencyInput);
          break;
        case 'get_eu_basis':
          result = await getEUBasis(db, args as unknown as GetEUBasisInput);
          break;
        case 'get_thai_implementations':
          result = await getThaiImplementations(db, args as unknown as GetThaiImplementationsInput);
          break;
        case 'search_eu_implementations':
          result = await searchEUImplementations(db, args as unknown as SearchEUImplementationsInput);
          break;
        case 'get_provision_eu_basis':
          result = await getProvisionEUBasis(db, args as unknown as GetProvisionEUBasisInput);
          break;
        case 'validate_eu_compliance':
          result = await validateEUCompliance(db, args as unknown as ValidateEUComplianceInput);
          break;
        case 'about':
          if (context) {
            result = getAbout(db, context);
          } else {
            return {
              content: [{ type: 'text', text: 'About tool not configured.' }],
              isError: true,
            };
          }
          break;
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}
