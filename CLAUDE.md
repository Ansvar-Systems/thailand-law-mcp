# Thailand Law MCP — Project Guide

## Overview
MCP server providing Thai primary legislation via Model Context Protocol. Data sourced from krisdika.go.th (Office of the Council of State). Strategy B deployment (runtime DB download on Vercel cold start).

## Architecture
- **Dual transport**: stdio (`src/index.ts`) + Streamable HTTP (`api/mcp.ts`)
- **Shared tool registry**: `src/tools/registry.ts` — both transports use identical tools
- **Database**: SQLite + FTS5, built by `scripts/build-db.ts` from seed JSON
- **Ingestion**: `scripts/ingest.ts` fetches HTML from krisdika.go.th, parses with cheerio

## Thailand-Specific Details
- **Buddhist Era calendar**: B.E. year = CE year + 543 (e.g., 2019 CE = B.E. 2562)
- **Bilingual**: Thai is legally binding; English translations are unofficial
- **Citation format**: `มาตรา 3 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562`
- **English citation**: `Section 3, Personal Data Protection Act B.E. 2562 (2019)`
- **Document IDs**: `pdpa-be2562` (abbreviation-BE year)

## Key Conventions
- All tool implementations return `ToolResponse<T>` with `results` + `_metadata`
- Database queries MUST use parameterized statements (never string interpolation)
- FTS5 queries go through `buildFtsQueryVariants()` for sanitization
- Statute IDs resolved via `resolveExistingStatuteId()` (exact match then LIKE on title/title_en/short_name)
- Journal mode must be DELETE (not WAL) for WASM/serverless compatibility

## Commands
- `npm test` — run unit + integration tests (vitest)
- `npm run test:contract` — run golden contract tests
- `npm run test:coverage` — coverage report
- `npm run build` — compile TypeScript
- `npm run validate` — full test suite (unit + contract)
- `npm run dev` — stdio server in dev mode
- `npm run ingest` — fetch legislation from krisdika.go.th
- `npm run build:db` — rebuild SQLite from seed JSON

## Testing
- Unit tests in `tests/` (in-memory test DB)
- Golden contract tests in `__tests__/contract/` driven by `fixtures/golden-tests.json`
- Drift detection via `fixtures/golden-hashes.json`
- Always run `npm run validate` before committing

## File Structure
- `src/tools/*.ts` — one file per MCP tool (13 tools + about)
- `src/utils/*.ts` — shared utilities (FTS, metadata, statute ID resolution, B.E./CE conversion)
- `src/citation/*.ts` — citation parsing, formatting, validation (Thai + English)
- `scripts/` — ingestion pipeline and maintenance scripts
- `api/` — Vercel serverless functions (health + MCP endpoint)
- `fixtures/` — golden tests and drift hashes

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.
