import { Lead } from '../schemas/lead.schema';

const COLUMN_MAP: Record<string, keyof Lead> = {
  'property id': 'property_id',
  property_id: 'property_id',
  'property address': 'property_address',
  address: 'property_address',
  city: 'city',
  state: 'state',
  zip: 'zip_code',
  'zip code': 'zip_code',
  'property type': 'property_type',
  type: 'property_type',
  'building size (sqft)': 'building_size_sqft',
  'building size': 'building_size_sqft',
  sqft: 'building_size_sqft',
  'year built': 'year_built',
  'owner name / entity': 'owner_entity',
  'owner name': 'owner_entity',
  owner: 'owner_entity',
  entity: 'owner_entity',
  'owner type': 'owner_type',
  'owner first name': 'owner_first_name',
  'first name': 'owner_first_name',
  'owner last name': 'owner_last_name',
  'last name': 'owner_last_name',
  'mailing address': 'mailing_address',
  'mailing city': 'mailing_city',
  'mailing state': 'mailing_state',
  'mailing zip': 'mailing_zip',
  'phone (skip traced)': 'phone',
  phone: 'phone',
  cell: 'phone',
  mobile: 'phone',
  email: 'email',
  'estimated value ($)': 'est_value',
  'estimated value': 'est_value',
  value: 'est_value',
  'last sale price ($)': 'last_sale_price',
  'last sale price': 'last_sale_price',
  'last sale date': 'last_sale_date',
  'years owned': 'years_owned',
  'loan amount ($)': 'loan_amount',
  'loan amount': 'loan_amount',
  'loan type': 'loan_type',
  'loan maturity date': 'loan_maturity_date',
  'equity (%)': 'equity_pct',
  equity: 'equity_pct',
  'vacancy indicator': 'vacancy',
  vacancy: 'vacancy',
  zoning: 'zoning',
  'outreach status': 'outreach_status',
  status: 'outreach_status',
};

const NUMERIC_FIELDS = new Set<keyof Lead>([
  'building_size_sqft',
  'year_built',
  'lot_size_acres',
  'est_value',
  'last_sale_price',
  'years_owned',
  'loan_amount',
  'equity_pct',
]);

const DATE_FIELDS = new Set<keyof Lead>(['last_sale_date', 'loan_maturity_date']);

function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const cleaned = String(value).replace(/[$,%\s]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  // Already a JS Date (from SheetJS cellDates: true)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  const str = String(value).trim();

  // MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return undefined;
}

/**
 * Normalizes a raw CSV/XLSX row into a clean Partial<Lead>.
 * Unknown columns are skipped with console.warn.
 * Empty string values become undefined so Mongoose omits them.
 */
export function normalizeRow(rawRow: Record<string, unknown>): Partial<Lead> {
  const result: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const normalizedKey = rawKey.toLowerCase().trim();
    const field = COLUMN_MAP[normalizedKey];

    if (!field) {
      console.warn(`[column-mapper] Unmapped column: "${rawKey}"`);
      continue;
    }

    if (DATE_FIELDS.has(field)) {
      const parsed = parseDate(rawValue);
      if (parsed !== undefined) result[field] = parsed;
    } else if (NUMERIC_FIELDS.has(field)) {
      const parsed = parseNumeric(rawValue);
      if (parsed !== undefined) result[field] = parsed;
    } else {
      const str = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';
      if (str !== '') result[field] = str;
    }
  }

  if (!result['property_id']) {
    result['property_id'] =
      'REC-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  return result as Partial<Lead>;
}
