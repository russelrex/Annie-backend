/**
 * In-memory job store for license verification jobs.
 * For production, replace with Redis or a MongoDB jobs collection.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { VerificationJob, JobStatus } from './interfaces/verification-job.interface';
import { LicenseVerificationResult } from './interfaces/verification-result.interface';

@Injectable()
export class JobStoreService {
  private readonly jobs = new Map<string, VerificationJob>();

  createJob(total: number): VerificationJob {
    const job: VerificationJob = {
      jobId: uuidv4(),
      status: 'queued',
      total,
      completed: 0,
      startedAt: new Date().toISOString(),
      results: [],
      errors: [],
    };
    this.jobs.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string): VerificationJob | undefined {
    return this.jobs.get(jobId);
  }

  updateJobStatus(jobId: string, status: JobStatus): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = status;
    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date().toISOString();
    }
    this.jobs.set(jobId, job);
  }

  addResult(jobId: string, result: LicenseVerificationResult): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.results.push(result);
    job.completed += 1;
    this.jobs.set(jobId, job);
  }

  addError(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.errors.push(error);
    this.jobs.set(jobId, job);
  }

  pruneOldJobs(maxAgeMs = 3_600_000): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - new Date(job.completedAt).getTime() > maxAgeMs
      ) {
        this.jobs.delete(id);
      }
    }
  }
}
