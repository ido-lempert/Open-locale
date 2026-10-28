import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService, truncate } from '../activity/activity.service';

@Injectable()
export class GlossaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  // Only the project's own locales, string values only, trimmed and non-empty.
  private cleanTranslations(projectLocales: string[], input?: Record<string, unknown>) {
    const out: Record<string, string> = {};
    for (const [locale, value] of Object.entries(input ?? {})) {
      if (!projectLocales.includes(locale)) {
        throw new BadRequestException(`Locale ${locale} is not part of this project`);
      }
      if (typeof value !== 'string') {
        throw new BadRequestException('Glossary translations must be strings');
      }
      const v = value.trim();
      if (v) out[locale] = v;
    }
    return out;
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.glossaryTerm.findMany({
      where: { projectId },
      orderBy: { term: 'asc' },
      take: 500,
    });
  }

  async create(userId: string, projectId: string, input: {
    term: string; notes?: string; doNotTranslate?: boolean; translations?: Record<string, string>;
  }) {
    const project = await this.projects.getFor(userId, projectId);
    const term = input.term.trim();
    if (!term) throw new BadRequestException('Term cannot be empty');
    const translations = this.cleanTranslations(project.locales.map((l) => l.code), input.translations);
    const dupe = await this.prisma.glossaryTerm.findFirst({ where: { projectId, term: { equals: term, mode: 'insensitive' } } });
    if (dupe) throw new ConflictException('This term already exists in the glossary');
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.glossaryTerm.create({
        data: { projectId, term, notes: input.notes?.trim() ?? '', doNotTranslate: input.doNotTranslate ?? false, translations },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'glossary.created', detail: { term: truncate(term, 80) },
      });
      return created;
    });
  }

  async update(userId: string, projectId: string, termId: string, input: {
    term?: string; notes?: string; doNotTranslate?: boolean; translations?: Record<string, string>;
  }) {
    const project = await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.glossaryTerm.findFirst({ where: { id: termId, projectId } });
    if (!existing) throw new NotFoundException('Glossary term not found');
    const data: Record<string, unknown> = {};
    if (input.term !== undefined) {
      const term = input.term.trim();
      if (!term) throw new BadRequestException('Term cannot be empty');
      data['term'] = term;
    }
    if (input.notes !== undefined) data['notes'] = input.notes.trim();
    if (input.doNotTranslate !== undefined) data['doNotTranslate'] = input.doNotTranslate;
    if (input.translations !== undefined) {
      data['translations'] = this.cleanTranslations(project.locales.map((l) => l.code), input.translations);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.glossaryTerm.update({ where: { id: termId }, data });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'glossary.updated',
        detail: { term: truncate(updated.term, 80), fields: Object.keys(data) },
      });
      return updated;
    });
  }

  async remove(userId: string, projectId: string, termId: string) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.glossaryTerm.findFirst({ where: { id: termId, projectId } });
    if (!existing) throw new NotFoundException('Glossary term not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.glossaryTerm.delete({ where: { id: termId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'glossary.deleted', detail: { term: truncate(existing.term, 80) },
      });
    });
    return { removed: termId };
  }
}
