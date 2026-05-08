import {
  Controller, Post, Get, Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LicenseVerificationService } from './license-verification.service';
import { StartVerificationDto } from './dto/start-verification.dto';

@Controller('license-verification')
export class LicenseVerificationController {
  constructor(private readonly service: LicenseVerificationService) {}

  /**
   * POST /api/license-verification/start
   * Enqueue a new license verification job. Max 25 leads per job.
   * Returns immediately with a jobId — poll the GET endpoint for progress.
   */
  @Post('start')
  @HttpCode(HttpStatus.ACCEPTED)
  startVerification(@Body() dto: StartVerificationDto) {
    return this.service.startJob(dto);
  }

  /**
   * GET /api/license-verification/job/:jobId
   * Poll job status and accumulated results.
   */
  @Get('job/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.service.getJob(jobId);
  }
}
