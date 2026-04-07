# Thai Law MCP Server

**The Royal Gazette (ราชกิจจานุเบกษา) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fthailand-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/thailand-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/thailand-law-mcp?style=social)](https://github.com/Ansvar-Systems/thailand-law-mcp)
[![CI](https://github.com/Ansvar-Systems/thailand-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/thailand-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-18%2C184-blue)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)

สืบค้น **517 กฎหมายไทย** -- ตั้งแต่ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) และประมวลกฎหมายอาญา ไปจนถึงประมวลกฎหมายแพ่งและพาณิชย์ กฎหมายแรงงาน และอื่น ๆ -- โดยตรงจาก Claude, Cursor หรือไคลเอนต์ที่รองรับ MCP

If you're building legal tech, compliance tools, or doing Thai legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Thai legal research is scattered across ratchakitchanubeksa.go.th, krisdika.go.th, and dopa.go.th, with many laws published only in Thai and requiring navigation of multiple government portals. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking PDPA obligations or Cybersecurity Act requirements
- A **legal tech developer** building tools on Thai law
- A **researcher** tracing Thai legislation across 517 Acts

...you shouldn't need dozens of browser tabs and manual cross-referencing across Thai-language government portals. Ask Claude. Get the exact provision. With context.

This MCP server makes Thai law **searchable, cross-referenceable, and AI-readable** in both Thai and English.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-th/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add thailand-law --transport http https://mcp.ansvar.eu/law-th/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "thailand-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-th/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "thailand-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-th/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/thailand-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "thailand-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/thailand-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"ค้นหา 'พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล' (PDPA) มาตราที่เกี่ยวกับความยินยอม"*
- *"ประมวลกฎหมายอาญา มาตรา 276 ว่าด้วยอะไร?"*
- *"ค้นหากฎหมายแรงงานเกี่ยวกับการเลิกจ้าง"*
- *"ประมวลกฎหมายแพ่งและพาณิชย์ ว่าด้วยสัญญาซื้อขาย"*
- *"What are the data breach notification requirements under the PDPA?"*
- *"Is the Computer Crime Act still in force?"*
- *"Find provisions about electronic transactions in Thai law"*
- *"What ASEAN frameworks does Thailand's Cybersecurity Act align with?"*
- *"Validate the citation: พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562, มาตรา 37"*
- *"Build a legal stance on personal data processing obligations in Thailand"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Acts** | 517 laws | Comprehensive Thai legislation |
| **Provisions** | 18,184 sections | Full-text searchable with FTS5 |
| **Database Size** | ~45 MB | Optimized SQLite, portable |
| **Languages** | Thai and English | Bilingual coverage where available |
| **Freshness Checks** | Automated | Drift detection against Krisdika |

### Key Laws Included

| Law | Thai Name |
|-----|-----------|
| Personal Data Protection Act (PDPA) | พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 |
| Cybersecurity Act | พ.ร.บ.การรักษาความมั่นคงปลอดภัยไซเบอร์ พ.ศ. 2562 |
| Computer Crime Act | พ.ร.บ.ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550 |
| Electronic Transactions Act | พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 |
| Civil and Commercial Code | ประมวลกฎหมายแพ่งและพาณิชย์ |
| Criminal Code | ประมวลกฎหมายอาญา |
| Labour Protection Act | พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 |

**Verified data only** -- every citation is validated against official sources (krisdika.go.th, ratchakitchanubeksa.go.th). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from krisdika.go.th and ratchakitchanubeksa.go.th official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains law text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act identifier + chapter/section
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Krisdika / Royal Gazette --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                ^                        ^
                         Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Krisdika by Act title in Thai | Search in Thai or English: *"คุ้มครองข้อมูลส่วนบุคคล"* |
| Navigate multi-chapter laws manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this law still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find ASEAN/WTO basis -- dig through treaty databases | `get_eu_basis` -- linked international frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search ratchakitchanubeksa.go.th --> Find PDF in Thai --> Search manually --> Cross-reference another Act --> Check ASEAN frameworks separately --> Repeat

**This MCP:** *"What are the consent requirements under Thailand's PDPA and how do they compare to international data protection standards?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 18,184 provisions with BM25 ranking. Supports Thai and English queries |
| `get_provision` | Retrieve specific provision by Act identifier + chapter/section (มาตรา) |
| `check_currency` | Check if a law is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple laws for a legal topic |
| `format_citation` | Format citations per Thai conventions (full/short/pinpoint) |
| `list_sources` | List all available laws with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (ASEAN, WTO, APEC) that a Thai law aligns with |
| `get_thai_implementations` | Find Thai laws implementing a specific international instrument |
| `search_eu_implementations` | Search international documents with Thai implementation counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Thai laws against international frameworks |

---

## International Law Alignment

Thailand is not an EU member state. Thai law aligns with international frameworks through:

- **ASEAN framework** -- Thailand is a founding ASEAN member; laws on digital economy, data protection (PDPA), and trade align with ASEAN frameworks
- **WTO membership** -- Trade and intellectual property law follows WTO commitments (TRIPS, GATS)
- **APEC** -- Thailand participates in APEC Cross-Border Privacy Rules (CBPR)
- **UNCITRAL** -- Electronic transactions law follows UNCITRAL Model Law on Electronic Commerce
- **สภาทนายความแห่งประเทศไทย (Lawyers Council of Thailand)** -- Professional legal practice regulated by the Lawyers Council of Thailand

The international bridge tools allow you to explore these alignment relationships -- checking which Thai provisions correspond to ASEAN or WTO requirements, and vice versa.

> **Note:** International cross-references reflect alignment and treaty obligation relationships. Thailand adopts its own legislative approach, and the tools help identify where Thai and international law address the same domains.

---

## Data Sources & Freshness

All content is sourced from authoritative Thai legal databases:

- **[Krisdika](https://www.krisdika.go.th/)** -- Council of State's official consolidated law database
- **[Royal Gazette (ราชกิจจานุเบกษา)](https://ratchakitchanubeksa.go.th/)** -- Official gazette, primary source for enacted legislation
- **[DOPA](https://www.dopa.go.th/)** -- Department of Provincial Administration legal references

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Council of State of Thailand (Krisdika) |
| **Languages** | Thai (primary), English translations for key Acts |
| **Coverage** | 517 laws across all legislative areas |
| **Last ingested** | 2026-02-28 |

### Automated Freshness Checks

A GitHub Actions workflow monitors all data sources:

| Check | Method |
|-------|--------|
| **Law amendments** | Drift detection against known provision anchors |
| **New laws** | Comparison against Krisdika index |
| **Repealed laws** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from Krisdika (Council of State) and the Royal Gazette. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (krisdika.go.th) for official proceedings
> - **International cross-references** reflect alignment relationships, not formal transposition
> - **English translations** are provided for reference; the authoritative text is in Thai
> - For professional legal advice in Thailand, consult a member of the **สภาทนายความแห่งประเทศไทย (Lawyers Council of Thailand)**

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/thailand-law-mcp
cd thailand-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest              # Ingest laws from official sources
npm run build:db            # Rebuild SQLite database
npm run check-updates       # Check for amendments and new laws
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~45 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, China, Denmark, Finland, France, Germany, Ghana, Iceland, India, Ireland, Israel, Italy, Japan, Kenya, Netherlands, Nigeria, Norway, Singapore, Slovenia, South Korea, Sweden, Switzerland, Thailand, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Expanded Thai-language provision coverage and English translations
- Court case law (Supreme Court / Dika Court decisions)
- Historical law versions and amendment tracking
- Sub-legislation (ministerial regulations, notifications)

---

## Roadmap

- [x] Core law database with FTS5 search
- [x] Full corpus ingestion (517 laws, 18,184 provisions)
- [x] International law alignment tools (ASEAN, WTO, APEC)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion (Dika Court)
- [ ] Expanded English translations for key Acts
- [ ] Historical law versions (amendment tracking)
- [ ] Sub-legislation coverage (ministerial regulations)

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{thailand_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Thai Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/thailand-law-mcp},
  note = {517 Thai laws with 18,184 provisions including PDPA, Criminal Code, and Civil and Commercial Code}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Council of State of Thailand / Royal Gazette (public domain)
- **International References:** ASEAN, WTO, APEC (public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Thai legal research -- turns out everyone building compliance tools for the Thai market has the same research frustrations.

So we're open-sourcing it. Navigating 517 Thai laws across Krisdika and the Royal Gazette shouldn't require hours of manual searching.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
