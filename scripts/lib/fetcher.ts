/**
 * Rate-limited HTTP client for krisdika.go.th (Office of the Council of State)
 *
 * - 500ms minimum delay between requests
 * - User-Agent header identifying the MCP
 * - Handles Thai HTML pages (UTF-8 encoding)
 * - No auth needed (government open data)
 */

const USER_AGENT = 'ThailandLawMCP/1.0 (https://github.com/Ansvar-Systems/thailand-law-mcp; hello@ansvar.ai)';
const BASE_URL = 'https://www.krisdika.go.th';
const MIN_DELAY_MS = 500;

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
 * Fetch the Krisdika library listing page (index of legislation).
 */
export async function fetchLibrarianIndex(category?: string): Promise<FetchResult> {
  const path = category
    ? `${BASE_URL}/librarian/${category}`
    : `${BASE_URL}/librarian/`;
  return fetchWithRateLimit(path);
}

/**
 * Fetch a specific act page by its system ID from Krisdika.
 */
export async function fetchActPage(sysId: string): Promise<FetchResult> {
  const url = `${BASE_URL}/librarian/getfile?sysid=${sysId}&fid=1&subfid=0`;
  return fetchWithRateLimit(url);
}

/**
 * Fetch an English translation of an act if available.
 */
export async function fetchActEnglish(sysId: string): Promise<FetchResult> {
  const url = `${BASE_URL}/librarian/getfile?sysid=${sysId}&fid=2&subfid=0`;
  return fetchWithRateLimit(url);
}
