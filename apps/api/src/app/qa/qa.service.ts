import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { ProjectsService } from '../projects/projects.service';

export interface QaIssue {
  keyId: string;
  key: string;
  locale: string;
  type: 'untranslated' | 'placeholder_mismatch' | 'max_length';
  detail: string;
}

// Placeholder families: ICU/simple {var} tokens and printf %s/%d/%f tokens.
export function placeholders(text: string): string[] {
  const braces = text.match(/\{[^{}]+\}/g) ?? [];
  const printf = text.match(/%[0-9]*\$?[sdif]/g) ?? [];
  return [...braces, ...printf].sort();
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
      const byLocale = new Map(key.translations.map((t) => [t.localeCode, t.value]));
      const source = byLocale.get(base) ?? '';
      for (const target of targets) {
        const value = byLocale.get(target) ?? '';
        if (source && !value) {
          issues.push({ keyId: key.id, key: key.name, locale: target, type: 'untranslated', detail: `no ${target} translation for non-empty ${base} source` });
          continue;
        }
        if (!value) continue;
        const srcPh = placeholders(source);
        const tgtPh = placeholders(value);
        if (srcPh.join('|') !== tgtPh.join('|')) {
          issues.push({
            keyId: key.id, key: key.name, locale: target, type: 'placeholder_mismatch',
            detail: `${base} has [${srcPh.join(', ') || 'none'}], ${target} has [${tgtPh.join(', ') || 'none'}]`,
          });
        }
        if (key.maxLength != null && value.length > key.maxLength) {
          issues.push({
            keyId: key.id, key: key.name, locale: target, type: 'max_length',
            detail: `${value.length} chars exceeds maxLength ${key.maxLength}`,
          });
        }
      }
    }
    return { issues };
  }
}
