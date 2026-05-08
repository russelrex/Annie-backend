/**
 * SELECTOR CONFIGURATION
 * These selectors target https://mylicense.in.gov/everification/
 *
 * IMPORTANT: Update this file if the site structure changes.
 * All selectors are centralized here so updates require changes in only one place.
 *
 * Last verified: 2026-05-08
 */

export const INDIANA_ELICENSE_SELECTORS = {
  BASE_URL: 'https://mylicense.in.gov/everification/',

  // Search form fields — single form, no tab switching needed.
  // Confirmed IDs from live site inspection.
  FIRST_NAME_INPUT: '#t_web_lookup__first_name',
  LAST_NAME_INPUT: '#t_web_lookup__last_name',
  CITY_INPUT: '#t_web_lookup__addr_city',
  STATE_SELECT: '#t_web_lookup__addr_state',
  LICENSE_NUMBER_INPUT: '#t_web_lookup__license_no',
  PROFESSION_SELECT: '#t_web_lookup__profession_name',
  SEARCH_BUTTON: '#sch_button',

  // Results table — rendered on the SearchResults page after form submission.
  // The table always has a header row (index 0) and a pagination row (last index).
  // Data rows are between them: indices 1..(rowCount-2).
  // A total rowCount of 2 means no results (header + pagination only).
  RESULTS_TABLE: '#datagrid_results',
  RESULTS_ROWS: '#datagrid_results > tbody > tr',

  // Per-row cell indices (direct <td> children of each data row, 1-based nth-child)
  RESULT_NAME_CELL: ':scope > td:nth-child(1)',       // licensee name (contains <a> link)
  RESULT_LICENSE_NUMBER_CELL: ':scope > td:nth-child(2)',
  RESULT_PROFESSION_CELL: ':scope > td:nth-child(3)',
  RESULT_LICENSE_TYPE_CELL: ':scope > td:nth-child(4)',
  RESULT_STATUS_CELL: ':scope > td:nth-child(5)',
  RESULT_ADDRESS_CELL: ':scope > td:nth-child(6)',    // "City STATE Zip" combined string

  // Security challenge / CAPTCHA indicators.
  // The site has a vestigial hidden #Recaptcha1 field that does not block Playwright.
  // These detect if a visible blocking challenge ever appears.
  CAPTCHA_INDICATORS: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    'text=verify you are human',
    'text=security check',
  ],

  // Site error states
  ERROR_INDICATORS: [
    'text=error occurred',
    'text=service unavailable',
    'text=try again later',
  ],
} as const;
