/**
 * OCS public API client for Thai legislation.
 *
 * Uses the public API at searchlaw.ocs.go.th/ocs-api/public/ which provides:
 *   - Discovery: POST /public/browse/searchByYear — 4,300+ laws paginated
 *   - Full text:  POST /public/doc/getLawDoc      — structured sections per law
 *   - HTML render: POST /public/doc/printHtml     — single-page HTML fallback
 *   - English:    POST /public/browse/searchEnByYear — 147 English translations
 *
 * No authentication required. All endpoints accept a standard reqHeader wrapper.
 *
 * - 300ms minimum delay between requests
 * - User-Agent header identifying the MCP
 * - No auth needed (government open data)
 */

const USER_AGENT = 'ThailandLawMCP/1.0 (https://github.com/Ansvar-Systems/thailand-law-mcp; hello@ansvar.ai)';
const API_BASE = 'https://searchlaw.ocs.go.th/ocs-api';
const MIN_DELAY_MS = 300;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// Request wrapper
// ─────────────────────────────────────────────────────────────────────────────

function buildReqHeader(serviceName: string): Record<string, string> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const dtm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`;

  return {
    reqId: String(Date.now()),
    reqChannel: 'WEB',
    reqDtm: dtm,
    reqBy: 'unknow',
    serviceName,
  };
}

async function postAPI<T = unknown>(
  path: string,
  serviceName: string,
  reqBody: Record<string, unknown>,
  maxRetries = 3,
): Promise<{ status: number; data: T }> {
  await rateLimit();

  const payload = {
    reqHeader: buildReqHeader(serviceName),
    reqBody,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`  HTTP ${response.status} for ${path}, retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }

      const json = await response.json() as Record<string, unknown>;

      // OCS wraps responses in { respHeader: {...}, respBody: {...} }
      const respHeader = json.respHeader as Record<string, string> | undefined;
      if (respHeader?.errorCode && respHeader.errorCode !== 'SUCCESS') {
        console.log(`\n  API error for ${path}: ${respHeader.errorCode} — ${respHeader.errorDesc ?? ''}`);
        return { status: response.status, data: {} as T };
      }

      const resBody = (json.respBody ?? json) as T;
      return { status: response.status, data: resBody };
    } catch (err) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  Error for ${path}: ${err}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to fetch ${path} after ${maxRetries} retries`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/** Entry from the old OCS search API (kept for backward compatibility). */
export interface OCSLawEntry {
  lawCode: string;
  lawNameTh: string | null;
  lawNameEn: string | false | null;
  contentlaw: string;
  encTimelineID: string;
  year: number;
  publishDate: string;
  lawEn: boolean | false;
  state: string;
  fileUUID: string;
  num: number;
}

/** Entry from /public/browse/searchByYear. */
export interface BrowseEntry {
  timelineId: string;
  lawCode: string;
  header: string;           // Thai law name
  headerEn?: string;        // English name (if translated)
  yearAd: number;           // CE year
  yearBe?: number;          // BE year
  lawCategoryId: string;    // e.g. "1B" for Acts
  publishDateAd: string;    // ISO date
  fileUuid?: string;
  hasLawTranslation: boolean;
  state?: string;           // "01" = in force
}

/** Section from /public/doc/getLawDoc. */
export interface LawSection {
  sectionId: string;
  sectionTypeId: number;    // 4=article, 8=chapter, 9=part, 1=title, etc.
  sectionNo: string;        // e.g. "42"
  sectionLabel: string;     // e.g. "มาตรา 42"
  sectionContent: string;   // HTML content
  orderNo: number;
}

/** Full response from /public/doc/getLawDoc. */
export interface LawDocResponse {
  lawInfo: {
    timelineId: string;
    lawCode: string;
    header: string;
    headerEn?: string;
    lawCategoryId: string;
    state: string;
    publishDateAd?: string;
    publishDateBe?: string;
  };
  lawSections: LawSection[];
  footnoteList?: Array<{ footnoteId: string; content: string }>;
  timelines?: Array<{ timelineId: string; versionName: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery — /public/browse/searchByYear
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover all Thai laws via the searchByYear endpoint.
 * Returns 4,300+ laws. Fetches in pages of 500.
 */
export async function discoverAllLaws(): Promise<BrowseEntry[]> {
  const allEntries: BrowseEntry[] = [];
  let page = 1;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const result = await postAPI<{ data?: BrowseEntry[]; pagination?: { totalRecords?: number } }>(
      '/public/browse/searchByYear',
      'searchPublicByYear',
      {
        yearAd: '',
        lawCategoryId: '',
        keyword: '',
        pagination: { pageNo: page, pageSize },
      },
    );

    const items = result.data?.data ?? [];
    if (items.length === 0) {
      hasMore = false;
    } else {
      allEntries.push(...items);
      const total = result.data?.pagination?.totalRecords ?? 0;
      console.log(`  Page ${page}: ${allEntries.length} / ${total} laws`);
      if (allEntries.length >= total || items.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allEntries;
}

/**
 * Discover English-translated laws via searchEnByYear.
 */
export async function discoverEnglishLaws(): Promise<BrowseEntry[]> {
  const allEntries: BrowseEntry[] = [];
  let page = 1;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const result = await postAPI<{ data?: BrowseEntry[]; pagination?: { totalRecords?: number } }>(
      '/public/browse/searchEnByYear',
      'searchPublicEnByYear',
      {
        yearAd: '',
        lawCategoryId: '',
        keyword: '',
        pagination: { pageNo: page, pageSize },
      },
    );

    const items = result.data?.data ?? [];
    if (items.length === 0) {
      hasMore = false;
    } else {
      allEntries.push(...items);
      const total = result.data?.pagination?.totalRecords ?? 0;
      if (allEntries.length >= total || items.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allEntries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full text — /public/doc/getLawDoc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the full structured content of a law by timelineId.
 * Returns sections with HTML content that can be stripped to plain text.
 */
export async function getLawDoc(timelineId: string): Promise<LawDocResponse | null> {
  const result = await postAPI<LawDocResponse>(
    '/public/doc/getLawDoc',
    'getPublicLawDoc',
    { timelineId },
  );

  if (!result.data?.lawInfo) return null;
  return result.data;
}

/**
 * Fetch a law rendered as a single HTML page (fallback).
 */
export async function getLawHtml(timelineId: string): Promise<string | null> {
  const result = await postAPI<{ contentHtml?: string }>(
    '/public/doc/printHtml',
    'printPublicLawAsHtml',
    { timelineId },
  );

  return result.data?.contentHtml ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy compatibility — fetchLibrarianIndex
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use discoverAllLaws() instead.
 * Kept for backward compatibility with existing ingest.ts code path.
 * Now internally uses the searchByYear API instead of the old letter-based search.
 */
export async function fetchLibrarianIndex(
  tab: 'law' | 'law_en' = 'law',
  _letterFilter?: string,
): Promise<FetchResult> {
  const entries = tab === 'law_en'
    ? await discoverEnglishLaws()
    : await discoverAllLaws();

  // Convert BrowseEntry[] to OCSLawEntry[] format for backward compat
  const ocsEntries: OCSLawEntry[] = entries.map(e => ({
    lawCode: e.lawCode,
    lawNameTh: e.header,
    lawNameEn: e.headerEn ?? null,
    contentlaw: '',
    encTimelineID: e.timelineId,
    year: e.yearAd + 543, // CE to BE
    publishDate: e.publishDateAd ?? '',
    lawEn: e.hasLawTranslation ?? false,
    state: e.state ?? '01',
    fileUUID: e.fileUuid ?? '',
    num: 0,
  }));

  return {
    status: ocsEntries.length > 0 ? 200 : 404,
    body: JSON.stringify(ocsEntries),
    contentType: 'application/json',
  };
}

/** @deprecated */
export async function searchLawsByKeyword(_keyword: string, _perpage = 20): Promise<OCSLawEntry[]> {
  return [];
}

/** @deprecated */
export async function fetchActPage(_sysId: string): Promise<FetchResult> {
  return { status: 404, body: '', contentType: '' };
}

/** @deprecated */
export async function fetchActEnglish(_sysId: string): Promise<FetchResult> {
  return { status: 404, body: '', contentType: '' };
}

/** @deprecated — use fetchWithRateLimit only for non-API URLs. */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    return {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
