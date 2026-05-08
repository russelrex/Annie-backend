/**
 * COMPLIANCE NOTICE:
 * - This service performs read-only public record lookups only.
 * - No CAPTCHA bypass, no authentication bypass, no rate limit evasion.
 * - If any security challenge is detected, the job stops immediately
 *   and marks the lead as Needs Manual Review.
 * - Delays are enforced between all requests.
 * - Max batch size is enforced at the controller level.
 */

import { chromium, Browser, Page } from 'playwright';
import { INDIANA_ELICENSE_SELECTORS as SEL } from './selectors';
import { LicenseVerificationResult } from '../interfaces/verification-result.interface';

export interface LeadSearchInput {
  leadId: string;
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
  licenseNumber?: string;
}

// Result rows beyond this count are reported as Multiple Matches without parsing all rows.
const MAX_AUTO_PARSE_ROWS = 5;

async function detectSecurityChallenge(page: Page): Promise<boolean> {
  for (const selector of SEL.CAPTCHA_INDICATORS) {
    try {
      const el = await page.$(selector);
      if (el) return true;
    } catch {
      // Selector may not match all page states — continue
    }
  }
  return false;
}

/**
 * Parse address string "City STATE Zip" into city and state components.
 * Examples: "Walkerton IN 46574" → { city: "Walkerton", state: "IN" }
 *           "Michigan City IN 46360" → { city: "Michigan City", state: "IN" }
 */
function parseAddress(address: string): { city: string; state: string } {
  const parts = address.trim().split(/\s+/);
  if (parts.length < 2) return { city: address.trim(), state: '' };
  // Format is: [city words...] [2-letter STATE] [zip]
  // The state abbreviation is always the second-to-last token
  const stateIdx = parts.length >= 3 ? parts.length - 2 : parts.length - 1;
  const state = parts[stateIdx] ?? '';
  const city = parts
    .slice(0, stateIdx)
    .join(' ')
    .replace(/,\s*$/, '');
  return { city, state };
}

async function parseResultRow(
  page: Page,
  rowIndex: number,
): Promise<Partial<LicenseVerificationResult>> {
  // rowIndex 0 = header, 1 = first data row, last = pagination
  const row = page.locator(SEL.RESULTS_ROWS).nth(rowIndex);

  const getText = async (selector: string): Promise<string> => {
    try {
      return ((await row.locator(selector).textContent()) ?? '').trim();
    } catch {
      return '';
    }
  };

  const addressRaw = await getText(SEL.RESULT_ADDRESS_CELL);
  const { city, state } = parseAddress(addressRaw);

  return {
    nameMatched: await getText(SEL.RESULT_NAME_CELL),
    licenseNumber: await getText(SEL.RESULT_LICENSE_NUMBER_CELL),
    profession: await getText(SEL.RESULT_PROFESSION_CELL),
    licenseType: await getText(SEL.RESULT_LICENSE_TYPE_CELL),
    licenseStatus: await getText(SEL.RESULT_STATUS_CELL),
    city,
    state,
  };
}

/**
 * Verify a single lead against the Indiana MyLicense eVerification portal.
 * Search priority:
 *   1. License number (if available and searchMethod allows)
 *   2. Last name + first name + state
 */
export async function verifyIndianaLicense(
  lead: LeadSearchInput,
  searchMethod: 'auto' | 'license_number' | 'name_city_state' = 'auto',
): Promise<LicenseVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const base: Partial<LicenseVerificationResult> = {
    leadId: lead.leadId,
    source: 'Indiana MyLicense eVerification',
    verifiedAt,
  };

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(SEL.BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (await detectSecurityChallenge(page)) {
      return {
        ...base,
        status: 'Needs Manual Review',
        notes: 'Security challenge detected on page load. Manual verification required.',
      } as LicenseVerificationResult;
    }

    const useLicenseSearch =
      searchMethod === 'license_number' ||
      (searchMethod === 'auto' && !!lead.licenseNumber);

    if (useLicenseSearch && lead.licenseNumber) {
      // License number search — fill only the license number field
      await page.fill(SEL.LICENSE_NUMBER_INPUT, lead.licenseNumber);
    } else {
      // Name search — fill last name (required), optionally first name and state
      if (lead.lastName) {
        await page.fill(SEL.LAST_NAME_INPUT, lead.lastName);
      }
      if (lead.firstName) {
        await page.fill(SEL.FIRST_NAME_INPUT, lead.firstName);
      }
      if (lead.city) {
        await page.fill(SEL.CITY_INPUT, lead.city);
      }
      if (lead.state) {
        try {
          await page.selectOption(SEL.STATE_SELECT, lead.state);
        } catch { /* ignore if state value not in dropdown */ }
      }
    }

    // Submit and wait for the SearchResults page to load
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }),
      page.click(SEL.SEARCH_BUTTON),
    ]);

    // Post-search security check
    if (await detectSecurityChallenge(page)) {
      return {
        ...base,
        status: 'Needs Manual Review',
        notes: 'Security challenge appeared after search. Manual verification required.',
      } as LicenseVerificationResult;
    }

    // Site error check
    for (const errSel of SEL.ERROR_INDICATORS) {
      try {
        const errEl = await page.$(errSel);
        if (errEl) {
          return {
            ...base,
            status: 'Error',
            notes: 'Site returned an error state. Try again later.',
          } as LicenseVerificationResult;
        }
      } catch { /* continue */ }
    }

    // Count result rows.
    // Structure: row[0] = header, row[1..N-1] = data, row[N] = pagination.
    // Total rows === 2 means no results (header + pagination only).
    const totalRows = await page.locator(SEL.RESULTS_ROWS).count();
    const dataRowCount = totalRows - 2;

    if (dataRowCount <= 0) {
      return {
        ...base,
        status: 'Not Found',
        notes: 'No matching license records found.',
      } as LicenseVerificationResult;
    }

    if (dataRowCount > MAX_AUTO_PARSE_ROWS) {
      const firstRow = await parseResultRow(page, 1);
      return {
        ...base,
        status: 'Multiple Matches',
        profession: firstRow.profession,
        licenseType: firstRow.licenseType,
        nameMatched: firstRow.nameMatched,
        notes: `${dataRowCount} results returned. First match: ${firstRow.nameMatched ?? 'unknown'}. Narrow the search or verify manually.`,
      } as LicenseVerificationResult;
    }

    // Parse the first data row (index 1)
    const parsed = await parseResultRow(page, 1);

    if (dataRowCount > 1) {
      return {
        ...base,
        status: 'Multiple Matches',
        ...parsed,
        notes: `${dataRowCount} results returned. First result shown; verify manually.`,
      } as LicenseVerificationResult;
    }

    return { ...base, status: 'Found', ...parsed } as LicenseVerificationResult;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Rethrow network/timeout errors so the caller can retry once
    if (
      message.includes('timeout') ||
      message.includes('net::ERR') ||
      message.includes('ECONNREFUSED')
    ) {
      throw err;
    }

    return {
      ...base,
      status: 'Error',
      notes: `Playwright error: ${message}`,
    } as LicenseVerificationResult;

  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
