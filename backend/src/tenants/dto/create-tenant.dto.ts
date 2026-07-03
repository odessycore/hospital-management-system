import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(200)
  name: string;

  /** URL/DB-safe unique slug, e.g. "st-marys". Lowercase letters, digits, hyphens. */
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,60}$/, {
    message:
      'slug must be lowercase, start with a letter, and contain only letters, digits and hyphens.',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // ── Initial hospital administrator (created with the tenant) ──
  // The admin receives an email invitation to set their own password.
  @IsString()
  @MaxLength(200)
  adminFullName: string;

  @IsEmail()
  adminEmail: string;
}
