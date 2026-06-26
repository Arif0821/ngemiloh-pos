import { IsString, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SettingItemDto {
  @IsString()
  @MaxLength(100)
  key: string = '';

  @IsString()
  value: string = '';
}

export class UpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  settings: SettingItemDto[] = [];
}
