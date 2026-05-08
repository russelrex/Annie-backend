import { LicenseVerificationResult } from './verification-result.interface';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface VerificationJob {
  jobId: string;
  status: JobStatus;
  total: number;
  completed: number;
  startedAt: string;
  completedAt?: string;
  results: LicenseVerificationResult[];
  errors: string[];
}
