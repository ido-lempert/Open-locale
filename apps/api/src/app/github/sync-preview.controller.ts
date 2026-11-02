import {
  BadRequestException,
  ConflictException,
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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  Equals,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { RepositoryLocalError } from './repository-local-error';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesService } from '../branches/branches.service';
import { BranchesModule } from '../branches/branches.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { deletionRecoveryTransaction } from './deletion-recovery-transaction';
import { inspectDeletionRecovery } from './deletion-recovery-plan';
import { parseSyncJson, previewSync } from './sync-preview';
import { resolvePlan, ResolutionChoice } from './resolve-preview';

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

class ResolveSyncPreviewDto extends LocalSyncPreviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  expectedFingerprint!: string;
  @IsObject()
  choices!: Record<string, ResolutionChoice>;
}

// Explicit local recovery only. No caller value, actor or scope coordinates.
class RecoverLocalDto {
  @Equals('recover-local-value') confirmation!: string;
  @IsUUID() expectedBranchId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) expectedKeyUpdatedAt!: string;
  @IsInt() @Min(1) @Max(2147483647) expectedKeyRevision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedValueDigest!: string;
  @IsInt() @Min(1) @Max(2147483647) targetRevision!: number;
  @IsString() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/) branch!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) locale!: string;
  @IsInt() @Min(1) @Max(2147483647) baselineVersion!: number;
  @IsString() @Matches(/^[a-f0-9]{40}$/) baselineSha!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) baselineDigest!: string;
}

@Injectable()
export class LocalSyncPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly branches: BranchesService,
  ) {}

  async resolve(
    user: AuthPrincipal,
    projectId: string,
    input: ResolveSyncPreviewDto,
  ) {
    // Re-read current authorized database snapshot; caller cannot supply local
    // values or downgrade the row-generation/project/locale binding.
    const plan = await this.preview(user, projectId, input);
    if (plan.fingerprint !== input.expectedFingerprint)
      throw new ConflictException('Preview changed; review a fresh preview');
    try {
      return {
        ...resolvePlan(plan, input.choices, input.expectedFingerprint),
        projectId,
        branch: plan.branch,
        locale: plan.locale,
        baselineVerified: false,
        remoteVerified: false,
      };
    } catch {
      throw new BadRequestException(
        'Expected one valid explicit choice per differing key within flat JSON bounds',
      );
    }
  }

  // Target-scoped read-only review,not an execution grant. Any future
  // executor must revalidate every binding in its SAME write transaction.
  async reviewRepositoryRecovery(user: AuthPrincipal, projectId: string, targetId: string, auditId: string) {
    if (user.via !== 'jwt') throw new ForbiddenException('Recovery review requires a signed-in session');
    // Caller-owned principals can change while authorization yields. Bind this
    // entire snapshot and returned review to the original authenticated actor.
    const actorId = user.userId;
    await this.projects.requireAdmin(actorId, projectId);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.projects.requireAdminInTransaction(tx, actorId, projectId);
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { teamId: true } });
      const member = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId: actorId } } });
      // Match current repository composition,which is direct-admin only.
      if (!member || !['OWNER','ADMIN'].includes(member.role)) throw new ForbiddenException('Repository recovery requires direct team admin');
      const stamp = await tx.$queryRaw<{asOf:Date}[]>`SELECT transaction_timestamp() AS "asOf"`;
      const deny = (reason: string) => ({ source: 'internal-repository-recovery-review' as const,
        asOf: stamp[0].asOf, reviewAvailable: false as const, reason, value: null,
        recovery: null, repository: null, canRestore: false as const, reservationHeld: false as const });
      const target = await tx.repositorySyncTarget.findFirst({ where: { id: targetId, projectId }, select: { id: true, revision: true, branchId: true, localBranch: true, locale: true,
        baseline: { select: { version: true, targetRevision: true, remoteSha: true, contentDigest: true } },
        branch: { select: { projectId: true, name: true } } } });
      if (!target || target.branch.projectId !== projectId || target.branch.name !== target.localBranch) return deny('target-unavailable');
      const base = target.baseline;
      if (!base || base.targetRevision !== target.revision) return deny('baseline-unavailable');
      const plan = await inspectDeletionRecovery(tx, projectId, auditId);
      if (!plan.eligible) return deny(plan.reason);
      if (plan.branchId !== target.branchId || plan.locale !== target.locale) return deny('target-scope-mismatch');
      const rows = await tx.$queryRaw<{value:string|null}[]>`
        SELECT CASE WHEN octet_length(snapshot->'row'->>'value') <= 32768
          THEN snapshot->'row'->>'value' ELSE NULL END AS value
        FROM translation_deletion_audits WHERE id=${auditId}::uuid AND "projectId"=${projectId}::uuid`;
      const value = rows[0]?.value ?? null;
      if (value === null) return deny('review-value-too-large');
      return { source: 'internal-repository-recovery-review' as const, asOf: stamp[0].asOf,
        reviewAvailable: true as const, reason: plan.reason, value,
        recovery: { projectId, actorId, auditId, expectedBranchId: plan.branchId!,
          expectedKeyUpdatedAt: plan.keyUpdatedAt!, expectedKeyRevision: plan.keyRevision!, expectedValueDigest: plan.valueDigest! },
        repository: { projectId, actorId, targetId: target.id, targetRevision: target.revision,
          branchId: target.branchId, branch: target.localBranch, locale: target.locale,
          baselineVersion: base.version, baselineSha: base.remoteSha, baselineDigest: base.contentDigest },
        canRestore: false as const, reservationHeld: false as const };
    }, { isolationLevel: 'RepeatableRead' });
  }
  // Internal authenticated execution boundary only,no HTTP route. Review is
  // explicit caller input,not a grant. Never refresh/retry stale reviewed scope.
  async executeRepositoryRecovery(
    user: AuthPrincipal, projectId: string, targetId: string, auditId: string,
    review: Pick<Awaited<ReturnType<LocalSyncPreviewService['reviewRepositoryRecovery']>>, 'reviewAvailable' | 'recovery' | 'repository'>,
  ) {
    if (user.via !== 'jwt') throw new ForbiddenException('Recovery execution requires a signed-in session');
    // Capture caller-owned primitives before authorization can yield.
    const recovery = review?.recovery ? { ...review.recovery } : null;
    const repository = review?.repository ? { ...review.repository } : null;
    if (!review?.reviewAvailable || !recovery || !repository ||
        recovery.projectId !== projectId || repository.projectId !== projectId ||
        repository.targetId !== targetId || recovery.auditId !== auditId ||
        recovery.actorId !== user.userId || repository.actorId !== user.userId)
      throw new ConflictException('Recovery review scope changed; review again');
    const actorId = user.userId;
    await this.projects.requireAdmin(actorId, projectId);
    try {
      return await this.prisma.$transaction(
        tx => deletionRecoveryTransaction(tx, { ...recovery, actorId }, { ...repository, actorId }),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof RepositoryLocalError) {
        if (error.kind === 'unsupported') throw new BadRequestException('Reviewed recovery is unsupported or exceeds local limits');
        throw new ConflictException(error.kind === 'backlog'
          ? 'Recovery effect backlog is full; review again after queued work is handled'
          : 'Recovery scope changed; review again');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2010' && error.meta?.['code'] === '55P03')
          throw new ConflictException('Recovery is busy; review again');
        if (error.code === 'P2034' || (error.code === 'P2010' && error.meta?.['code'] === '40001'))
          throw new ConflictException('Concurrent recovery change; review again');
      }
      // Unknown storage/programming failures remain faults. Never refresh/retry.
      throw error;
    }
  }
  async previewDeletionRecovery(user: AuthPrincipal, projectId: string, auditId: string) {
    if (user.via !== 'jwt') throw new ForbiddenException('Recovery preview requires a signed-in session');
    await this.projects.requireAdmin(user.userId, projectId);
    // One consistent diagnostic snapshot,not a lock/reservation/execution grant.
    const {plan,asOf} = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.projects.requireAdminInTransaction(tx, user.userId, projectId);
      const stamp = await tx.$queryRaw<{asOf:Date}[]>`SELECT transaction_timestamp() AS "asOf"`;
      return {plan: await inspectDeletionRecovery(tx, projectId, auditId), asOf: stamp[0].asOf};
    }, { isolationLevel: 'RepeatableRead' });
    return { source: 'deletion-recovery-eligibility-preview', asOf, eligibleNow: plan.eligible,
      reason: plan.reason, canRestore: false, snapshotIncluded: false,
      historyReplay: false, reservationHeld: false };
  }
  async reviewDeletionRecoveryValue(user: AuthPrincipal, projectId: string, auditId: string) {
    if (user.via !== 'jwt') throw new ForbiddenException('Recovery value review requires a signed-in session');
    await this.projects.requireAdmin(user.userId, projectId);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.projects.requireAdminInTransaction(tx, user.userId, projectId);
      const stamp = await tx.$queryRaw<{asOf:Date}[]>`SELECT transaction_timestamp() AS "asOf"`;
      const plan = await inspectDeletionRecovery(tx, projectId, auditId);
      // Value review is a separate explicit read. Never return history,full snapshot,
      // internal binding digest/revision or a token that could execute recovery.
      const rows = plan.eligible ? await tx.$queryRaw<{value:string|null}[]>`
        SELECT CASE WHEN octet_length(snapshot->'row'->>'value') <= 32768
          THEN snapshot->'row'->>'value' ELSE NULL END AS value
        FROM translation_deletion_audits WHERE id=${auditId}::uuid AND "projectId"=${projectId}::uuid` : [];
      const value = rows[0]?.value ?? null;
      return { source: 'deletion-recovery-value-review', asOf: stamp[0].asOf,
        reviewAvailable: plan.eligible && value !== null,
        reason: plan.eligible && value === null ? 'review-value-too-large' : plan.reason,
        value, maxValueBytes: 32768, canRestore: false, snapshotIncluded: false,
        historyReplay: false, reservationHeld: false };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async listDeletionAudits(user: AuthPrincipal, projectId: string, cursor?: string) {
    if (user.via !== 'jwt') throw new ForbiddenException('Deletion audit metadata requires a signed-in session');
    await this.projects.requireAdmin(user.userId, projectId);
    let boundary: { createdAt: Date; id: string } | undefined;
    if (cursor !== undefined) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 160 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
        const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
        const pair: unknown = JSON.parse(decoded);
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pair[1]) ||
            new Date(pair[0]).toISOString() !== pair[0] || Buffer.from(JSON.stringify(pair)).toString('base64url') !== cursor) throw new Error();
        boundary = { createdAt: new Date(pair[0]), id: pair[1] };
      } catch { throw new BadRequestException('Invalid deletion audit cursor'); }
    }
    const rows = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.projects.requireAdminInTransaction(tx, user.userId, projectId);
      return tx.translationDeletionAudit.findMany({
      where: { projectId, ...(boundary ? { OR: [
        { createdAt: { lt: boundary.createdAt } },
        { createdAt: boundary.createdAt, id: { lt: boundary.id } },
      ] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51,
      select: { id: true, keyId: true, keyName: true, localeCode: true, actorId: true, createdAt: true },
      });
    }, { isolationLevel: 'RepeatableRead' });
    const audits = rows.slice(0, 50);
    const last = audits.at(-1);
    return {
      source: 'local-deletion-audit-metadata', audits,
      nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString('base64url') : null,
      snapshotIncluded: false, canRestore: false,
    };
  }
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
    includePreconditions = false,
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
            maxLength: true,
            updatedAt: true,
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
            k.updatedAt.toISOString(),
            k.maxLength,
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
      ...(includePreconditions ? {localPreconditions: {
        projectId, branchId: branch.id, branch: branch.name, locale: input.locale,
        keys: rows.map(k => ({keyId:k.id,key:k.name,keyUpdatedAt:k.updatedAt.toISOString(),maxLength:k.maxLength,
          translation:k.translations[0] ? {rowId:k.translations[0].rowId,version:k.translations[0].version,value:k.translations[0].value} : null})),
        requiresExactKeySet:true as const,canApply:false as const,
      }} : {}),
    };
  }
}

@Controller('projects/:projectId/sync')
@UseGuards(JwtAuthGuard)
export class LocalSyncPreviewController {
  constructor(private readonly previews: LocalSyncPreviewService) {}
  @Post('resolve-preview')
  @Header('Cache-Control', 'no-store')
  resolve(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: ResolveSyncPreviewDto,
  ) {
    return this.previews.resolve(user, projectId, input);
  }
  @Post('repository-targets/:targetId/deletion-audits/:auditId/recover-local')
  @Header('Cache-Control', 'no-store')
  async recoverLocal(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() input: RecoverLocalDto,
  ) {
    const actorId = user.userId;
    const result = await this.previews.executeRepositoryRecovery(user, projectId, targetId, auditId, {
      reviewAvailable: true,
      recovery: { projectId, actorId, auditId, expectedBranchId: input.expectedBranchId,
        expectedKeyUpdatedAt: input.expectedKeyUpdatedAt, expectedKeyRevision: input.expectedKeyRevision,
        expectedValueDigest: input.expectedValueDigest },
      repository: { projectId, actorId, targetId, targetRevision: input.targetRevision,
        branchId: input.expectedBranchId, branch: input.branch, locale: input.locale,
        baselineVersion: input.baselineVersion, baselineSha: input.baselineSha, baselineDigest: input.baselineDigest },
    });
    return { ...result, source: 'repository-target-local-recovery', repositorySyncAccepted: false };
  }
  @Get('repository-targets/:targetId/deletion-audits/:auditId/recovery-review')
  @Header('Cache-Control', 'no-store')
  async reviewRepositoryRecovery(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
  ) {
    const review = await this.previews.reviewRepositoryRecovery(user, projectId, targetId, auditId);
    return { ...review, source: 'repository-target-recovery-review', maxValueBytes: 32768,
      snapshotIncluded: false, historyReplay: false };
  }
  @Get('deletion-audits/:auditId/recovery-value-review')
  @Header('Cache-Control', 'no-store')
  reviewDeletionRecoveryValue(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
  ) { return this.previews.reviewDeletionRecoveryValue(user, projectId, auditId); }
  @Get('deletion-audits/:auditId/recovery-preview')
  @Header('Cache-Control', 'no-store')
  previewDeletionRecovery(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
  ) { return this.previews.previewDeletionRecovery(user, projectId, auditId); }
  @Get('deletion-audits')
  @Header('Cache-Control', 'no-store')
  listDeletionAudits(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.previews.listDeletionAudits(user, projectId, cursor);
  }
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
  exports: [LocalSyncPreviewService],
})
export class LocalSyncPreviewModule {}
