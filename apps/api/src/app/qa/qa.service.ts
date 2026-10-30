import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { ProjectsService } from '../projects/projects.service';

export interface QaIssue {
  keyId: string;
  key: string;
  locale: string;
  type: 'untranslated' | 'placeholder_mismatch' | 'max_length' | 'whitespace' | 'number_mismatch' | 'html_mismatch';
  detail: string;
}

// Placeholder families: ICU/simple {var} tokens and printf %s/%d/%f tokens.
export function placeholders(text: string): string[] {
  const braces = text.match(/\{[^{}]+\}/g) ?? [];
  const printf = text.match(/%[0-9]*\$?[sdif]/g) ?? [];
  return [...braces, ...printf].sort();
}

// Number tokens: digit sequences with an optional decimal part. Compared
// as sorted multisets between source and target.
export function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).sort();
}

// HTML tag signature: tag name lowercased with a closing marker, attributes
// ignored. Compared as sorted multisets between source and target.
export function htmlTags(text: string): string[] {
  return (text.match(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?>/g) ?? [])
    .map((t) => {
      const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(t);
      return m ? `${m[1]}${m[2].toLowerCase()}` : t;
    })
    .sort();
}

@Injectable()
export class QaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly branches: BranchesService,
  ) {}

  async run(userId: string, projectId: string, locale?: string, branch?: string): Promise<{ issues: QaIssue[] }> {
    const project = await this.projects.getFor(userId, projectId);
    const b = await this.branches.branchFor(projectId, branch);
    const base = project.baseLocale;
    const targets = project.locales
      .map((l) => l.code)
      .filter((c) => c !== base && (!locale || c === locale));
    const keys = await this.prisma.key.findMany({
      where: { projectId, branchId: b.id },
      include: { translations: true },
      orderBy: { name: 'asc' },
    });
    const issues: QaIssue[] = [];
    for (const key of keys) {
      const byLocale = new Map(key.translations.map((t) => [t.localeCode, t]));
      const srcRow = byLocale.get(base);
      const source = srcRow?.value ?? '';
      const srcForms = (srcRow?.pluralForms ?? null) as Record<string, string> | null;
      for (const target of targets) {
        const tRow = byLocale.get(target);
        const value = tRow?.value ?? '';
        if (source && !value) {
          issues.push({ keyId: key.id, key: key.name, locale: target, type: 'untranslated', detail: `no ${target} translation for non-empty ${base} source` });
          continue;
        }
        if (!value) continue;
        // Plural keys with source forms are checked per category, anchored
        // on the source form set: a missing or empty target form for a
        // category the source fills is untranslated; placeholder sets and
        // maxLength are compared per category form. The value-level checks
        // below would double-report the 'other' form, so they are skipped.
        // Categories the target locale needs beyond the source set (e.g.
        // Arabic zero/two on an English source) are NOT derived here -
        // documented limitation.
        if (key.isPlural && srcForms) {
          const tgtForms = (tRow?.pluralForms ?? null) as Record<string, string> | null;
          for (const [cat, sv] of Object.entries(srcForms)) {
            if (!sv) continue;
            const tv = tgtForms?.[cat] ?? '';
            if (!tv) {
              issues.push({ keyId: key.id, key: key.name, locale: target, type: 'untranslated', detail: `no ${target} translation for category "${cat}" of non-empty ${base} source` });
              continue;
            }
            this.checkPair(issues, key, base, target, sv, tv, `category "${cat}": `);
          }
          continue;
        }
        this.checkPair(issues, key, base, target, source, value, '');
      }
    }
    return { issues };
  }

  // All per-text checks for one source/target pair. prefix labels the
  // detail when the pair is one plural category form (category "one": ...).
  private checkPair(
    issues: QaIssue[],
    key: { id: string; name: string; maxLength: number | null },
    base: string, target: string, source: string, value: string, prefix: string,
  ) {
    const srcPh = placeholders(source);
    const tgtPh = placeholders(value);
    if (srcPh.join('|') !== tgtPh.join('|')) {
      issues.push({
        keyId: key.id, key: key.name, locale: target, type: 'placeholder_mismatch',
        detail: `${prefix}${base} has [${srcPh.join(', ') || 'none'}], ${target} has [${tgtPh.join(', ') || 'none'}]`,
      });
    }
    if (key.maxLength != null && value.length > key.maxLength) {
      issues.push({
        keyId: key.id, key: key.name, locale: target, type: 'max_length',
        detail: `${prefix}${value.length} chars exceeds maxLength ${key.maxLength}`,
      });
    }
    const srcLead = /^\s/.test(source);
    const tgtLead = /^\s/.test(value);
    const srcTrail = /\s$/.test(source);
    const tgtTrail = /\s$/.test(value);
    if (srcLead !== tgtLead || srcTrail !== tgtTrail) {
      const parts: string[] = [];
      if (srcLead !== tgtLead) parts.push(`leading whitespace: ${base} ${srcLead ? 'yes' : 'no'}, ${target} ${tgtLead ? 'yes' : 'no'}`);
      if (srcTrail !== tgtTrail) parts.push(`trailing whitespace: ${base} ${srcTrail ? 'yes' : 'no'}, ${target} ${tgtTrail ? 'yes' : 'no'}`);
      issues.push({ keyId: key.id, key: key.name, locale: target, type: 'whitespace', detail: prefix + parts.join('; ') });
    }
    const srcNums = numberTokens(source);
    const tgtNums = numberTokens(value);
    if (srcNums.join('|') !== tgtNums.join('|')) {
      issues.push({
        keyId: key.id, key: key.name, locale: target, type: 'number_mismatch',
        detail: `${prefix}${base} has [${srcNums.join(', ') || 'none'}], ${target} has [${tgtNums.join(', ') || 'none'}]`,
      });
    }
    const srcTags = htmlTags(source);
    const tgtTags = htmlTags(value);
    if (srcTags.join('|') !== tgtTags.join('|')) {
      issues.push({
        keyId: key.id, key: key.name, locale: target, type: 'html_mismatch',
        detail: `${prefix}${base} has [${srcTags.join(', ') || 'none'}], ${target} has [${tgtTags.join(', ') || 'none'}]`,
      });
    }
  }
}
