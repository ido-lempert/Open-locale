import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Header,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesService } from '../branches/branches.service';
import { BranchesModule } from '../branches/branches.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { parseSyncJson, previewSync } from './sync-preview';

class LocalSyncPreviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/)
  branch!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  locale!: string;
  // Raw JSON strings retain duplicate properties for parser validation.
  // Small request limits fit within the default HTTP JSON body bound.
  @IsString()
  @MaxLength(32768)
  baselineJson!: string;
  @IsString()
  @MaxLength(32768)
  remoteJson!: string;
  @IsString()
  @Matches(/^[a-f0-9]{40}$/)
  remoteSha!: string;
}

@Injectable()
export class LocalSyncPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly branches: BranchesService,
  ) {}

  async listRecords(user: AuthPrincipal, projectId: string) {
    if (user.via !== 'jwt')
      throw new ForbiddenException('Sync preview requires a signed-in session');
    await this.projects.requireAdmin(user.userId, projectId);
    return {
      source: 'caller-supplied-files',
      canApply: false,
      records: await this.prisma.syncPreviewRecord.findMany({
        where: { projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    };
  }

  async record(
    user: AuthPrincipal,
    projectId: string,
    input: LocalSyncPreviewDto,
  ) {
    // Recompute, never accept caller-provided summary/fingerprint or actor.
    const plan = await this.preview(user, projectId, input);
    const summary = {
      unchanged: 0,
      converged: 0,
      'local-only': 0,
      'remote-only': 0,
      conflict: 0,
      manual: 0,
      total: plan.decisions.length,
    };
    for (const d of plan.decisions) {
      summary[d.kind]++;
      if (d.suggested === 'manual') summary.manual++;
    }
    // No key names, values, baseline/remote files, or credentials retained.
    // Re-check current membership before creating persistent history.
    await this.projects.requireAdmin(user.userId, projectId);
    const record = await this.prisma.$transaction(async (tx) => {
      // Serialize create/trim by project even across processes.
      await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId}::uuid FOR UPDATE`;
      const saved = await tx.syncPreviewRecord.create({
        data: {
          projectId,
          actorId: user.userId,
          branch: plan.branch,
          locale: plan.locale,
          fingerprint: plan.fingerprint,
          remoteSha: plan.remoteSha,
          summary,
        },
      });
      await tx.$executeRaw`DELETE FROM sync_preview_records WHERE "projectId"=${projectId}::uuid AND id IN (
        SELECT id FROM sync_preview_records WHERE "projectId"=${projectId}::uuid
        ORDER BY "createdAt" DESC,id DESC OFFSET 100)`;
      return saved;
    });
    return {
      record,
      source: 'caller-supplied-files',
      baselineVerified: false,
      remoteVerified: false,
      canApply: false,
    };
  }

  async preview(
    user: AuthPrincipal,
    projectId: string,
    input: LocalSyncPreviewDto,
  ) {
    if (user.via !== 'jwt')
      throw new ForbiddenException('Sync preview requires a signed-in session');
    // Reject unauthorized requests before parsing or reading translation data.
    await this.projects.requireAdmin(user.userId, projectId);
    const project = await this.projects.getFor(user.userId, projectId);
    if (!project.locales.some((l) => l.code === input.locale))
      throw new BadRequestException('Unknown project locale');
    const branch = await this.branches.branchFor(projectId, input.branch);
    let base: ReturnType<typeof parseSyncJson>,
      remote: ReturnType<typeof parseSyncJson>;
    try {
      base = parseSyncJson(input.baselineJson);
      remote = parseSyncJson(input.remoteJson);
    } catch {
      throw new BadRequestException(
        'Expected bounded, duplicate-free flat string JSON files',
      );
    }

    // Prisma may load relations separately. Repeatable-read keeps metadata,
    // text and row identities in one coherent snapshot. Bound materialization.
    const rows = await this.prisma.$transaction(
      async (tx) => {
        const [budget] = await tx.$queryRaw<
          { count: bigint; bytes: bigint; unsupported: bigint }[]
        >`
        SELECT count(k.id) AS count,
          count(*) FILTER (WHERE k."isPlural" OR (t."pluralForms" IS NOT NULL AND t."pluralForms" <> 'null'::jsonb)) AS unsupported,
          COALESCE(sum(octet_length(k.name) + COALESCE(octet_length(t.value), 0)), 0)::bigint AS bytes
        FROM keys k LEFT JOIN translations t ON t."keyId" = k.id AND t."localeCode" = ${input.locale}
        WHERE k."projectId" = ${projectId}::uuid AND k."branchId" = ${branch.id}::uuid`;
        if (budget.count > BigInt(10000) || budget.bytes > BigInt(512 * 1024))
          throw new BadRequestException('Sync branch exceeds bounds');
        if (budget.unsupported > BigInt(0))
          throw new BadRequestException(
            'Flat sync preview does not support plural keys',
          );
        return tx.key.findMany({
          where: { projectId, branchId: branch.id },
          orderBy: { name: 'asc' },
          take: 10001,
          select: {
            id: true,
            name: true,
            isPlural: true,
            translations: {
              where: { localeCode: input.locale },
              select: {
                value: true,
                version: true,
                rowId: true,
                pluralForms: true,
              },
            },
          },
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
    if (rows.length > 10000)
      throw new BadRequestException('Sync branch exceeds key bound');
    if (
      rows.some(
        (k) => k.isPlural || k.translations.some((t) => t.pluralForms !== null),
      )
    )
      throw new BadRequestException(
        'Flat sync preview does not support plural keys',
      );
    const local: Record<string, string> = Object.create(null);
    for (const key of rows)
      if (key.translations[0]) local[key.name] = key.translations[0].value;
    let plan: ReturnType<typeof previewSync>;
    try {
      plan = previewSync(base, local, remote, input.remoteSha);
    } catch {
      throw new BadRequestException('Unsupported or oversized flat sync data');
    }
    // The pure planner's hash alone is not an execution token. Bind this
    // diagnostic fingerprint to project, branch, locale AND row generations.
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          projectId,
          branch.id,
          input.locale,
          plan.fingerprint,
          rows.map((k) => [
            k.id,
            k.name,
            k.translations.map((t) => [t.rowId, t.version]),
          ]),
        ]),
      )
      .digest('hex');
    return {
      ...plan,
      fingerprint,
      projectId,
      branch: branch.name,
      locale: input.locale,
      source: 'caller-supplied-files',
      remoteVerified: false,
      baselineVerified: false,
      canApply: false,
    };
  }
}

@Controller('projects/:projectId/sync')
@UseGuards(JwtAuthGuard)
export class LocalSyncPreviewController {
  constructor(private readonly previews: LocalSyncPreviewService) {}
  @Get('preview-records')
  @Header('Cache-Control', 'no-store')
  listRecords(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.previews.listRecords(user, projectId);
  }
  @Post('preview-records')
  @Header('Cache-Control', 'no-store')
  record(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: LocalSyncPreviewDto,
  ) {
    return this.previews.record(user, projectId, input);
  }
  @Post('preview')
  @Header('Cache-Control', 'no-store')
  preview(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: LocalSyncPreviewDto,
  ) {
    return this.previews.preview(user, projectId, input);
  }
}

@Module({
  imports: [AuthModule, ProjectsModule, BranchesModule],
  controllers: [LocalSyncPreviewController],
  providers: [LocalSyncPreviewService],
})
export class LocalSyncPreviewModule {}
