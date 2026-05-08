import { IsString, IsIn, IsOptional } from 'class-validator';

export class StartVerificationDto {
  @IsString()
  propertyId: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsIn(['name', 'business', 'license_number'])
  searchMethod: 'name' | 'business' | 'license_number';

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
