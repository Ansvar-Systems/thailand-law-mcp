/**
 * Rate-limited HTTP client for ocs.go.th (Office of the Council of State)
 *
 * As of 2025, krisdika.go.th redirects to ocs.go.th. The old /librarian/
 * URL structure is gone. The new portal uses:
 *   - Search API: POST https://www.ocs.go.th/searchlaw/indexs/list_table_search
 *   - Document viewer: SPA at https://searchlaw.ocs.go.th/council-of-state/
 *
 * The search API returns law metadata (lawCode, lawNameTh, encTimelineID, year,
 * state) and a truncated contentlaw snippet. Full text is only available through
 * the SPA viewer's backend API (which requires session auth).
 *
 * Discovery strategy: iterate through the Thai alphabet using the letter filter
 * to enumerate all laws. Each letter returns up to 20 results per page.
 *
 * - 500ms minimum delay between requests
 * - User-Agent header identifying the MCP
 * - No auth needed (government open data)
 */

const USER_AGENT = 'ThailandLawMCP/1.0 (https://github.com/Ansvar-Systems/thailand-law-mcp; hello@ansvar.ai)';
const BASE_URL = 'https://www.ocs.go.th';
const SEARCH_API = `${BASE_URL}/searchlaw/indexs/list_table_search`;
const MIN_DELAY_MS = 500;

// Thai alphabet letters used as filters in the OCS search API
const THAI_LETTERS = [
  'ก','ข','ค','ง','จ','ช','ด','ต','ถ','ท','ธ','น',
  'บ','ป','ผ','ฝ','พ','ฟ','ภ','ม','ย','ร','ล','ว','ศ','ส','ห','อ',
];

// English alphabet for the law_en tab
const ENGLISH_LETTERS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','R','S','T','U','V','W',
];

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Raw entry from the OCS search API response.
 */
export interface OCSLawEntry {
  lawCode: string;
  lawNameTh: string | null;
  lawNameEn: string | false | null;
  contentlaw: string;
  encTimelineID: string;
  year: number;
  publishDate: string;
  lawEn: boolean | false;
  state: string;     // "01" = in force
  fileUUID: string;
  num: number;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, application/xhtml+xml, */*',
        'Accept-Language': 'th,en;q=0.9',
      },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * POST to the OCS search API with rate limiting and retry.
 */
async function postSearchAPI(params: Record<string, string>, maxRetries = 3): Promise<{ status: number; data: OCSLawEntry[]; meta: Record<string, unknown> }> {
  await rateLimit();

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(SEARCH_API, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} from search API, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const raw = await response.text();

    // The API prepends PHP error notices before the JSON. Strip them.
    const jsonStart = raw.indexOf('{"meta');
    if (jsonStart === -1) {
      // Try alternative JSON start
      const altStart = raw.indexOf('{"error');
      if (altStart !== -1) {
        const parsed = JSON.parse(raw.slice(altStart));
        return { status: response.status, data: [], meta: parsed };
      }
      return { status: response.status, data: [], meta: {} };
    }

    const parsed = JSON.parse(raw.slice(jsonStart));
    return {
      status: response.status,
      data: parsed.data ?? [],
      meta: parsed.meta ?? {},
    };
  }

  throw new Error(`Failed to fetch from search API after ${maxRetries} retries`);
}

/**
 * Fetch the OCS law index using the search API.
 *
 * Iterates through Thai alphabet letters to enumerate all laws.
 * The API returns up to 20 results per page; for letters with more than 20 laws,
 * multiple pages are fetched.
 *
 * @param tab - 'law' for Thai laws, 'law_en' for English translations
 * @param letterFilter - optional single letter to fetch only that letter
 */
export async function fetchLibrarianIndex(
  tab: 'law' | 'law_en' = 'law',
  letterFilter?: string,
): Promise<FetchResult> {
  const letters = letterFilter
    ? [letterFilter]
    : (tab === 'law_en' ? ENGLISH_LETTERS : THAI_LETTERS);

  const allEntries: OCSLawEntry[] = [];

  for (const letter of letters) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await postSearchAPI({
        'query[tab_type]': tab,
        'query[page]': String(page),
        'query[perpage]': '20',
        'query[letter]': letter,
        'query[pagination]': '1',
      });

      if (result.data.length === 0) {
        hasMore = false;
      } else {
        // Check if this page is the same as the first page (API pagination bug for law_en)
        if (page > 1 && result.data.length > 0) {
          const firstEncId = result.data[0]?.encTimelineID;
          const alreadySeen = allEntries.some(e => e.encTimelineID === firstEncId);
          if (alreadySeen) {
            hasMore = false;
            continue;
          }
        }

        allEntries.push(...result.data);
        // The API caps at 20 per page. If we got fewer, there are no more pages.
        if (result.data.length < 20) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
  }

  // Return as a FetchResult with the entries serialized as JSON
  return {
    status: allEntries.length > 0 ? 200 : 404,
    body: JSON.stringify(allEntries),
    contentType: 'application/json',
  };
}

/**
 * Search for specific laws by Thai keyword.
 * Uses the topic search with relevance ranking.
 */
export async function searchLawsByKeyword(keyword: string, perpage = 20): Promise<OCSLawEntry[]> {
  const result = await postSearchAPI({
    'query[tab_type]': 'law',
    'query[page]': '1',
    'query[perpage]': String(perpage),
    'query[pagination]': '1',
    'query[q]': keyword,
    'query[topic]': '1',
    'query[sort]': 'score-desc',
  });
  return result.data;
}

/**
 * Fetch a specific act page by its system ID from the old Krisdika URL scheme.
 *
 * NOTE: These URLs no longer work since krisdika.go.th redirected to ocs.go.th.
 * This function is kept for backward compatibility with existing seed data
 * but will return 404 for all requests.
 */
export async function fetchActPage(sysId: string): Promise<FetchResult> {
  // Old URL structure is dead. Return a stub.
  console.log(`  WARNING: fetchActPage(${sysId}) — old krisdika.go.th URLs no longer work.`);
  return {
    status: 404,
    body: '',
    contentType: '',
  };
}

/**
 * Fetch an English translation of an act if available.
 *
 * NOTE: These URLs no longer work since krisdika.go.th redirected to ocs.go.th.
 */
export async function fetchActEnglish(sysId: string): Promise<FetchResult> {
  console.log(`  WARNING: fetchActEnglish(${sysId}) — old krisdika.go.th URLs no longer work.`);
  return {
    status: 404,
    body: '',
    contentType: '',
  };
}
