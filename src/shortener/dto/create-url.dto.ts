import {
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  originalUrl!: string;

  @IsOptional()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'alias must match /^[A-Za-z0-9_-]+$/',
  })
  alias?: string;
}
