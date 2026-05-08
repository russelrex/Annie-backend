import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { LicenseVerificationController } from './license-verification.controller';
import { LicenseVerificationService } from './license-verification.service';
import { JobStoreService } from './job-store.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }])],
  controllers: [LicenseVerificationController],
  providers: [LicenseVerificationService, JobStoreService],
})
export class LicenseVerificationModule {}
