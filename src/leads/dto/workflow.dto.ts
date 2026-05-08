import { IsString, IsOptional, IsBoolean, IsArray, IsIn } from 'class-validator';

const VALID_STAGES = [
  'Imported', 'Cleaning', 'Cleaned', 'Email Enrichment',
  'Forewarn Verification', 'Ready for Outreach', 'Outreach Started',
  'Follow-up 1 Sent', 'Follow-up 2 Sent', 'Follow-up 3 Sent',
  'Follow-up 4 Sent', 'Follow-up 5 Sent', 'Follow-up 6 Sent',
  'Completed', 'Removed',
];

export class UpdateStageDto {
  @IsString()
  @IsIn(VALID_STAGES)
  stage: string;
}

export class UpdateChecklistDto {
  @IsOptional() @IsBoolean() propertyConfirmed?: boolean;
  @IsOptional() @IsBoolean() ownerIdentityVerified?: boolean;
  @IsOptional() @IsBoolean() phoneVerified?: boolean;
  @IsOptional() @IsBoolean() emailVerified?: boolean;
  @IsOptional() @IsBoolean() foreWarnCleared?: boolean;
  @IsOptional() @IsBoolean() licenseVerified?: boolean;
  @IsOptional() @IsBoolean() doNotContactChecked?: boolean;
  @IsOptional() @IsBoolean() outreachDrafted?: boolean;
  @IsOptional() @IsBoolean() approvedForOutreach?: boolean;
}

export class AddNoteDto {
  @IsString()
  text: string;
}

export class BulkStageDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @IsIn(VALID_STAGES)
  stage: string;
}

export class BulkStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsOptional() @IsString() email_status?: string;
  @IsOptional() @IsString() phone_status?: string;
  @IsOptional() @IsString() forewarn_status?: string;
}

export class BulkScheduleDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsString()
  next_followup: string;
}
