import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';

export const AUTOMATION_TRIGGERS = ['key.created', 'translation.value'] as const;
export const AUTOMATION_ACTIONS = ['pretranslate', 'task.create', 'notify'] as const;
// Bounds on every run: at most this many target locales per pretranslate rule.
export const AUTOMATION_LOCALE_CAP = 5;

export class CreateAutomationRuleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(AUTOMATION_TRIGGERS) trigger!: string;
  @IsIn(AUTOMATION_ACTIONS) action!: string;
  // pretranslate: { providerId: string, locales: string[] (1..5, non-base project locales) }
  // task.create:  { title: string (may contain {key}), assigneeId?: string }
  // notify:       { message: string (may contain {key}) } - dispatches the project's
  //               admin-managed webhooks subscribed to automation.notify; the rule
  //               itself carries no URL, so rules add no SSRF surface.
  @IsObject() config!: Record<string, unknown>;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateAutomationRuleDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class PretranslateRuleConfig {
  @IsUUID() providerId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(AUTOMATION_LOCALE_CAP) @IsString({ each: true }) locales!: string[];
}
