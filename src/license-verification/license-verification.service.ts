/**
 * COMPLIANCE NOTICE:
 * - Read-only public record lookups only.
 * - No CAPTCHA bypass, no auth bypass, no rate limit evasion.
 * - 3–8 second random delay enforced between all Playwright requests.
 * - Max 25 leads per job enforced at DTO level.
 * - Processed sequentially — no parallelism.
 * - Security challenges immediately abort all remaining leads in the job.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { JobStoreService } from './job-store.service';
import { verifyIndianaLicense } from './playwright/license-verification.playwright';
import { StartVerificationDto } from './dto/start-verification.dto';
import { LicenseVerificationResult } from './interfaces/verification-result.interface';
import { VerificationJob } from './interfaces/verification-job.interface';

@Injectable()
export class LicenseVerificationService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly jobStore: JobStoreService,
  ) {}

  async startJob(dto: StartVerificationDto): Promise<{ jobId: string; status: string }> {
    const leads = (await this.leadModel
      .find({ property_id: { $in: dto.leadIds } })
      .lean()) as unknown as Array<Record<string, unknown>>;

    if (!leads.length) {
      throw new NotFoundException('No matching leads found for provided IDs');
    }

    const job = this.jobStore.createJob(leads.length);

    // Fire-and-forget — caller polls /job/:jobId
    this.runJob(job.jobId, leads, dto.searchMethod).catch(err => {
      console.error(`[license-verification] Job ${job.jobId} crashed:`, err);
      this.jobStore.updateJobStatus(job.jobId, 'failed');
    });

    return { jobId: job.jobId, status: 'queued' };
  }

  getJob(jobId: string): VerificationJob {
    const job = this.jobStore.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }

  private async runJob(
    jobId: string,
    leads: Array<Record<string, unknown>>,
    searchMethod: 'auto' | 'license_number' | 'name_city_state',
  ): Promise<void> {
    this.jobStore.updateJobStatus(jobId, 'running');

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      let result: LicenseVerificationResult;

      const searchInput = {
        leadId: String(lead['property_id'] ?? ''),
        firstName: String(lead['owner_first_name'] ?? ''),
        lastName: String(lead['owner_last_name'] ?? ''),
        city: String(lead['city'] ?? ''),
        state: String(lead['state'] ?? ''),
        licenseNumber: String(lead['licenseNumber'] ?? ''),
      };

      try {
        try {
          result = await verifyIndianaLicense(searchInput, searchMethod);
        } catch (networkErr: unknown) {
          const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
          console.warn(`[license-verification] Retrying ${searchInput.leadId}: ${msg}`);
          await this.randomDelay(5000, 5000);
          result = await verifyIndianaLicense(searchInput, searchMethod);
        }
      } catch (err: unknown) {
        result = {
          leadId: searchInput.leadId,
          status: 'Error',
          source: 'Indiana MyLicense eVerification',
          verifiedAt: new Date().toISOString(),
          notes: `Failed after retry: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      await this.persistResult(searchInput.leadId, result);
      this.jobStore.addResult(jobId, result);

      // Security challenge → abort remaining leads
      if (result.status === 'Needs Manual Review' && result.notes?.includes('Security challenge')) {
        this.jobStore.addError(
          jobId,
          'Security challenge detected — remaining leads aborted. Run again later.',
        );
        this.jobStore.updateJobStatus(jobId, 'failed');
        return;
      }

      // Rate limit: 3–8 second delay between requests (skip after last)
      if (i < leads.length - 1) {
        await this.randomDelay(3000, 8000);
      }
    }

    this.jobStore.updateJobStatus(jobId, 'completed');
  }

  private async persistResult(
    propertyId: string,
    result: LicenseVerificationResult,
  ): Promise<void> {
    await this.leadModel.findOneAndUpdate(
      { property_id: propertyId },
      {
        $set: {
          licenseVerificationStatus: result.status,
          licenseProfession: result.profession ?? '',
          licenseType: result.licenseType ?? '',
          licenseNumber: result.licenseNumber ?? '',
          licenseStatus: result.licenseStatus ?? '',
          licenseExpirationDate: result.expirationDate ?? '',
          licenseVerifiedAt: result.verifiedAt,
          licenseSource: result.source,
          licenseNotes: result.notes ?? '',
        },
      },
    );

    console.log(
      `[AUDIT] license-verification lead=${propertyId}` +
      ` status=${result.status}` +
      ` at=${result.verifiedAt}` +
      ` source=${result.source}`,
    );
  }

  private randomDelay(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
