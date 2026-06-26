import { IsString, IsBoolean, MaxLength } from 'class-validator';

export class ToggleFlagDto {
  @IsString()
  @MaxLength(100)
  name: string = '';

  @IsBoolean()
  is_enabled: boolean = false;
}
