import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLeadsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  outreachStatus?: string;

  @IsOptional()
  @IsString()
  licenseVerificationStatus?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
