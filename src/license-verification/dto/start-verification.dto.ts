import { IsArray, IsString, ArrayMinSize, ArrayMaxSize, IsIn } from 'class-validator';

export class StartVerificationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  leadIds: string[];

  @IsIn(['auto', 'license_number', 'name_city_state'])
  searchMethod: 'auto' | 'license_number' | 'name_city_state';
}
