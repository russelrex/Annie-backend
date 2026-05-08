import * as XLSX from 'xlsx';

/**
 * Parses a CSV or XLSX buffer into an array of raw row objects.
 * Uses cellDates: true so Date cells come back as JS Date objects.
 */
export function parseUploadedFile(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];
}
