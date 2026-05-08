export const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}
