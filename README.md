# Thailand Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/thailand-law-mcp)](https://www.npmjs.com/package/@ansvar/thailand-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/thailand-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/thailand-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/thailand-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/thailand-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Thai legislation, including the Personal Data Protection Act (PDPA), Computer Crime Act, Cybersecurity Act, Electronic Transactions Act, and Civil and Commercial Code with full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~60-120 MB (full corpus of Thai federal legislation with English translations)

## Key Legislation Covered

| Act | Year (B.E. / CE) | Significance |
|-----|-------------------|-------------|
| **Personal Data Protection Act (PDPA)** | B.E. 2562 / 2019 | Comprehensive data protection law modeled on EU GDPR; full enforcement from 1 June 2022; establishes the PDPC |
| **Computer Crime Act** | B.E. 2550 / 2007 (amended B.E. 2560 / 2017) | Criminalises unauthorised computer access, data interference, and content offences |
| **Cybersecurity Act** | B.E. 2562 / 2019 | Framework for critical information infrastructure protection; establishes the National Cybersecurity Committee (NCSC) |
| **Electronic Transactions Act** | B.E. 2544 / 2001 | Legal recognition of electronic transactions, electronic signatures, and electronic documents |
| **Civil and Commercial Code** | B.E. 2468 / 1925 (amended) | Core civil law framework including contract, tort, and relevant privacy provisions |
| **Constitution of the Kingdom of Thailand** | B.E. 2560 / 2017 | Supreme law; includes provisions on rights and liberties |

## Regulatory Context

- **Data Protection Supervisory Authority:** Personal Data Protection Committee (PDPC), established under the PDPA B.E. 2562
- **Cybersecurity Regulator:** National Cybersecurity Committee (NCSC), established under the Cybersecurity Act B.E. 2562
- **Thailand's PDPA** was modeled on the EU GDPR; full enforcement began 1 June 2022 after multiple delays from the original 2020 deadline
- Thailand uses the **Buddhist Era (B.E.)** calendar for legislation: B.E. year = CE year + 543
- Thai is the legally binding language; English translations are available for major laws but are unofficial
- Thailand is a member of ASEAN and participates in the ASEAN Framework on Personal Data Protection
- The Computer Crime Act was amended in 2017 to strengthen enforcement and expand content regulation provisions

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Office of the Council of State (Krisdika)](https://www.krisdika.go.th) | Office of the Council of State | HTML Scrape | Weekly | Government Open Data | All Acts, Royal Decrees, Ministerial Regulations, English translations |
| [Royal Thai Government Gazette](https://ratchakitcha.soc.go.th) | Cabinet Secretariat | PDF | Weekly | Government Publication | Official gazette including Acts, notifications, announcements |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/thailand-law-mcp
```

## Usage

### As stdio MCP server

```bash
thailand-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "thailand-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/thailand-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a Thai Act |
| `search_legislation` | Full-text search across all Thai legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, ASEAN, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (PDPA, Computer Crime Act, Cybersecurity Act)
- 3 search tests (personal data, computer crime, electronic transaction)
- 2 citation roundtrip tests (official krisdika.go.th URL patterns)
- 2 cross-reference tests (GDPR relationship, ASEAN/NIS framework)
- 2 negative tests (non-existent Act, malformed section)

Run with: `npm run test:contract`

## Buddhist Era (B.E.) Date Reference

Thailand uses the Buddhist Era calendar for legislation. Quick conversion:

| B.E. Year | CE Year | Key Law |
|-----------|---------|---------|
| B.E. 2562 | 2019 | PDPA, Cybersecurity Act |
| B.E. 2560 | 2017 | Computer Crime Act (amendment), Constitution |
| B.E. 2550 | 2007 | Computer Crime Act (original) |
| B.E. 2544 | 2001 | Electronic Transactions Act |

**Formula:** CE year = B.E. year - 543

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/thailand-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
