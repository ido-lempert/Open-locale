import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const WEBHOOK_EVENTS = ['translation.updated'] as const;

export class CreateWebhookDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsArray() @ArrayNotEmpty() @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];

  // Optional: a strong secret is generated when omitted. Returned once, in the
  // create response only; it is never included in list/update responses.
  @IsOptional() @IsString() @MaxLength(200)
  secret?: string;
}

export class UpdateWebhookDto {
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional() @IsArray() @ArrayNotEmpty() @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: string[];

  @IsOptional() @IsBoolean()
  active?: boolean;
}
