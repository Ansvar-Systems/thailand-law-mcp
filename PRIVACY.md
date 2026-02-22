# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Thai legal professional rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Lawyers Council of Thailand (สภาทนายความ) rules require strict confidentiality and data handling controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/thailand-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/thailand-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://thailand-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text, provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Thailand)

### Lawyers Council of Thailand and Lawyers Act

Thai lawyers (ทนายความ) are bound by strict confidentiality rules under the Lawyers Act B.E. 2528 (1985) and the Lawyers Council of Thailand Code of Ethics.

#### Attorney-Client Confidentiality

- All attorney-client communications are protected under the Lawyers Act
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Professional secrecy obligations extend beyond the termination of the engagement

### PDPA and Client Data Processing

Under the **Personal Data Protection Act B.E. 2562 (2019) (PDPA, พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล)**:

- You are the **Data Controller** (ผู้ควบคุมข้อมูลส่วนบุคคล) when processing client personal data
- AI service providers (Anthropic, Vercel) may be **Data Processors** (ผู้ประมวลผลข้อมูลส่วนบุคคล)
- A **data processing agreement** is required under PDPA Section 40
- Cross-border data transfers must comply with PDPA Section 28 requirements (adequate protection standards)
- The **Personal Data Protection Committee (PDPC)** oversees compliance

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does the Civil and Commercial Code say about contractual obligations?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for securities fraud under Thai law?"
```

- Query pattern may reveal you are working on a securities matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (ThaiLaw, LexisNexis TH, Westlaw Thailand)

### For Large Firms / Corporate Legal

1. Negotiate data processing agreements with AI service providers under PDPA Section 40
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns

### For Government / Public Sector

1. Use self-hosted deployment, no external APIs
2. Follow Thai government information security requirements (MDES guidelines)
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/thailand-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Lawyers Council Guidance**: Consult Lawyers Council of Thailand (สภาทนายความ) ethics guidance

---

**Last Updated**: 2026-02-22
**Tool Version**: 1.0.0
