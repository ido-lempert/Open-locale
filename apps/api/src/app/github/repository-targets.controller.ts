import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import {
  IsInt,
  IsObject,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesService } from '../branches/branches.service';
import { BranchesModule } from '../branches/branches.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { repositoryUrl } from './repository-target';
import {
  repositoryReader,
  RepositoryReadUnavailable,
} from './repository-reader';
import { parseSyncJson } from './sync-preview';
import { resolvePlan, ResolutionChoice } from './resolve-preview';
import { createHash } from 'node:crypto';
import {
  LocalSyncPreviewModule,
  LocalSyncPreviewService,
} from './sync-preview.controller';
class TargetDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/)
  localBranch!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) locale!: string;
  @IsString() @IsNotEmpty() @MaxLength(39) owner!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) repo!: string;
  @IsString() @IsNotEmpty() @MaxLength(1024) path!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) remoteBranch!: string;
}
class RevisionDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision!: number;
}
class UpdateTargetDto extends TargetDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision!: number;
}
class AcceptBaselineDto extends RevisionDto {
  @IsString() @Matches(/^[a-f0-9]{40}$/) expectedRemoteSha!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedContentDigest!: string;
  @IsInt() @Min(0) @Max(2147483646) expectedBaselineVersion!: number;
}
class ResolveRepositoryDto extends RevisionDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedFingerprint!: string;
  @IsObject() choices!: Record<string, ResolutionChoice>;
}
const posture = {
  source: 'repository-target-configuration',
  connected: false,
  baselineAccepted: false,
  canApply: false,
};
@Injectable()
export class RepositoryTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly branches: BranchesService,
    private readonly previews: LocalSyncPreviewService,
  ) {}
  private async authorize(user: AuthPrincipal, projectId: string) {
    if (user.via !== 'jwt')
      throw new ForbiddenException(
        'Repository target configuration requires a signed-in session',
      );
    await this.projects.requireAdmin(user.userId, projectId);
  }
  private async data(user: AuthPrincipal, projectId: string, input: TargetDto) {
    const project = await this.projects.getFor(user.userId, projectId);
    if (!project.locales.some((l) => l.code === input.locale))
      throw new BadRequestException('Unknown project locale');
    const branch = await this.branches.branchFor(projectId, input.localBranch);
    try {
      repositoryUrl({
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        branch: input.remoteBranch,
      });
    } catch {
      throw new BadRequestException('Invalid repository target coordinates');
    }
    // Whitelist only coordinates, never credentials, actor or connection status.
    return {
      branchId: branch.id,
      localBranch: input.localBranch,
      locale: input.locale,
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      remoteBranch: input.remoteBranch,
    };
  }
  async list(user: AuthPrincipal, projectId: string) {
    await this.authorize(user, projectId);
    return {
      ...posture,
      targets: await this.prisma.repositorySyncTarget.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    };
  }
  async save(
    user: AuthPrincipal,
    projectId: string,
    input: TargetDto,
    id?: string,
    expectedRevision?: number,
  ) {
    await this.authorize(user, projectId);
    const data = await this.data(user, projectId, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize cap/create/update/delete across processes for this project.
        await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId}::uuid FOR UPDATE`;
        if (id) {
          const current = await tx.repositorySyncTarget.findFirst({
            where: { id, projectId },
          });
          if (!current)
            throw new NotFoundException('Repository target not found');
          const changed = await tx.repositorySyncTarget.updateMany({
            where: { id, projectId, revision: expectedRevision },
            data: { ...data, revision: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException(
              'Repository target changed; reload configuration',
            );
          // Coordinate replacement invalidates all previously accepted bytes.
          await tx.repositorySyncBaseline.deleteMany({
            where: { targetId: id },
          });
          return {
            ...posture,
            target: await tx.repositorySyncTarget.findUniqueOrThrow({
              where: { id },
            }),
          };
        }
        if (
          (await tx.repositorySyncTarget.count({ where: { projectId } })) >= 100
        )
          throw new BadRequestException('Repository target limit reached');
        return {
          ...posture,
          target: await tx.repositorySyncTarget.create({
            data: { projectId, ...data },
          }),
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'A target already exists for this local branch and locale',
        );
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      )
        throw new ConflictException(
          'Repository target scope changed; reload configuration',
        );
      throw e;
    }
  }
  async read(
    user: AuthPrincipal,
    projectId: string,
    id: string,
    expectedRevision: number,
  ) {
    await this.authorize(user, projectId);
    const target = await this.prisma.repositorySyncTarget.findFirst({
      where: { id, projectId },
    });
    if (!target) throw new NotFoundException('Repository target not found');
    if (target.revision !== expectedRevision)
      throw new ConflictException(
        'Repository target changed; reload configuration',
      );
    const coordinates = {
      owner: target.owner,
      repo: target.repo,
      path: target.path,
      branch: target.remoteBranch,
    };
    let file: { text: string; sha: string; path: string };
    try {
      const reader = repositoryReader(coordinates);
      file = await reader.read(
        coordinates.owner,
        coordinates.repo,
        coordinates.path,
        coordinates.branch,
      );
      // This flow is flat-string-only, never silently flatten nested/plural data.
      parseSyncJson(file.text);
    } catch (e) {
      if (e instanceof RepositoryReadUnavailable)
        throw new ServiceUnavailableException(e.message);
      throw new BadGatewayException(
        'Repository file could not be read as bounded flat string JSON',
      );
    }
    // Access/config may have changed while the network request was in flight.
    // Do not expose bytes from a removed or reconfigured target or lost grant.
    await this.authorize(user, projectId);
    const current = await this.prisma.repositorySyncTarget.findFirst({
      where: { id, projectId, revision: expectedRevision },
    });
    if (!current)
      throw new ConflictException(
        'Repository target changed; reload configuration',
      );
    return {
      source: 'repository-target-read',
      targetId: id,
      targetRevision: target.revision,
      remoteSha: file.sha,
      json: file.text,
      contentDigest: createHash('sha256').update(file.text).digest('hex'),
      remoteVerified: true,
      baselineAccepted: false,
      canApply: false,
    };
  }
  async preview(
    user: AuthPrincipal,
    projectId: string,
    id: string,
    expectedRevision: number,
  ) {
    await this.authorize(user, projectId);
    const target = await this.prisma.repositorySyncTarget.findFirst({
      where: { id, projectId, revision: expectedRevision },
      include: { baseline: true },
    });
    if (!target)
      throw new ConflictException(
        'Repository target changed; reload configuration',
      );
    if (!target.baseline || target.baseline.targetRevision !== target.revision)
      throw new ConflictException(
        'Accept a comparison baseline before repository preview',
      );
    const baseline = target.baseline;
    const remote = await this.read(user, projectId, id, expectedRevision);
    // Existing snapshot reader enforces project/locale/plural/key/byte bounds
    // and binds database row generations. No local JSON supplied by caller.
    const plan = await this.previews.preview(user, projectId, {
      branch: target.localBranch,
      locale: target.locale,
      baselineJson: baseline.text,
      remoteJson: remote.json,
      remoteSha: remote.remoteSha,
    });
    await this.authorize(user, projectId);
    const current = await this.prisma.repositorySyncTarget.findFirst({
      where: { id, projectId, revision: expectedRevision },
      include: { baseline: true },
    });
    if (
      !current?.baseline ||
      current.baseline.version !== baseline.version ||
      current.baseline.contentDigest !== baseline.contentDigest
    )
      throw new ConflictException(
        'Repository target or baseline changed; review again',
      );
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          id,
          target.revision,
          target.owner,
          target.repo,
          target.path,
          target.remoteBranch,
          baseline.version,
          baseline.remoteSha,
          baseline.contentDigest,
          plan.fingerprint,
        ]),
      )
      .digest('hex');
    return {
      ...plan,
      fingerprint,
      targetId: id,
      targetRevision: target.revision,
      baselineVersion: baseline.version,
      baselineSha: baseline.remoteSha,
      source: 'accepted-baseline-repository-preview',
      remoteVerified: true,
      baselineVerified: true,
      canApply: false,
      localTranslationsChanged: false,
      remoteWritten: false,
    };
  }
  async resolve(
    user: AuthPrincipal,
    projectId: string,
    id: string,
    input: ResolveRepositoryDto,
  ) {
    // Recompute all three sources from authorized scope, never caller files.
    const plan = await this.preview(user, projectId, id, input.expectedRevision);
    if (plan.fingerprint !== input.expectedFingerprint)
      throw new ConflictException('Repository preview changed; review a fresh comparison');
    try {
      return {
        ...resolvePlan(plan, input.choices, input.expectedFingerprint),
        source: 'explicit-repository-preview-resolution',
        projectId,
        targetId: id,
        targetRevision: plan.targetRevision,
        branch: plan.branch,
        locale: plan.locale,
        baselineVersion: plan.baselineVersion,
        baselineSha: plan.baselineSha,
        remoteSha: plan.remoteSha,
        baselineProvenanceVerified: true,
        baselineVerified: true,
        remoteVerified: true,
        canApply: false,
        localTranslationsChanged: false,
        remoteWritten: false,
      };
    } catch {
      throw new BadRequestException(
        'Expected one valid explicit choice per differing key within flat JSON bounds',
      );
    }
  }
  async baseline(user: AuthPrincipal, projectId: string, id: string) {
    await this.authorize(user, projectId);
    const target = await this.prisma.repositorySyncTarget.findFirst({
      where: { id, projectId },
    });
    if (!target) throw new NotFoundException('Repository target not found');
    const baseline = await this.prisma.repositorySyncBaseline.findUnique({
      where: { targetId: id },
    });
    if (baseline && baseline.targetRevision !== target.revision)
      throw new ConflictException(
        'Repository target changed; reload configuration',
      );
    return {
      source: 'accepted-repository-baseline',
      targetId: id,
      targetRevision: target.revision,
      baseline,
      baselineAccepted: !!baseline,
      canApply: false,
    };
  }
  async acceptBaseline(
    user: AuthPrincipal,
    projectId: string,
    id: string,
    input: AcceptBaselineDto,
  ) {
    // Fresh verified remote read, not caller file bytes or a trusted-looking SHA.
    const snapshot = await this.read(
      user,
      projectId,
      id,
      input.expectedRevision,
    );
    if (
      snapshot.remoteSha !== input.expectedRemoteSha ||
      snapshot.contentDigest !== input.expectedContentDigest
    )
      throw new ConflictException(
        'Repository file changed; read and review it again',
      );
    await this.authorize(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId}::uuid FOR UPDATE`;
      const target = await tx.repositorySyncTarget.findFirst({
        where: { id, projectId, revision: input.expectedRevision },
      });
      if (!target)
        throw new ConflictException(
          'Repository target changed; reload configuration',
        );
      const previous = await tx.repositorySyncBaseline.findUnique({
        where: { targetId: id },
      });
      if ((previous?.version ?? 0) !== input.expectedBaselineVersion)
        throw new ConflictException(
          'Repository baseline changed; reload baseline',
        );
      const data = {
        version: input.expectedBaselineVersion + 1,
        targetRevision: target.revision,
        remoteSha: snapshot.remoteSha,
        contentDigest: snapshot.contentDigest,
        text: snapshot.json,
        actorId: user.userId,
        acceptedAt: new Date(),
      };
      const baseline = await tx.repositorySyncBaseline.upsert({
        where: { targetId: id },
        create: { targetId: id, ...data },
        update: data,
      });
      return {
        source: 'accepted-repository-baseline',
        baseline,
        baselineAccepted: true,
        canApply: false,
        localTranslationsChanged: false,
        remoteWritten: false,
      };
    });
  }
  async remove(
    user: AuthPrincipal,
    projectId: string,
    id: string,
    expectedRevision: number,
  ) {
    await this.authorize(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId}::uuid FOR UPDATE`;
      const current = await tx.repositorySyncTarget.findFirst({
        where: { id, projectId },
      });
      if (!current) throw new NotFoundException('Repository target not found');
      const removed = await tx.repositorySyncTarget.deleteMany({
        where: { id, projectId, revision: expectedRevision },
      });
      if (removed.count !== 1)
        throw new ConflictException(
          'Repository target changed; reload configuration',
        );
      return { ...posture, removed: true };
    });
  }
}
@Controller('projects/:projectId/sync/repository-targets')
@UseGuards(JwtAuthGuard)
export class RepositoryTargetsController {
  constructor(private readonly targets: RepositoryTargetsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.targets.list(user, projectId);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: TargetDto,
  ) {
    return this.targets.save(user, projectId, input);
  }
  @Post(':targetId/preview')
  @Header('Cache-Control', 'no-store')
  preview(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: RevisionDto,
  ) {
    return this.targets.preview(user, projectId, id, input.expectedRevision);
  }
  @Post(':targetId/resolve-preview')
  @Header('Cache-Control', 'no-store')
  resolve(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: ResolveRepositoryDto,
  ) {
    return this.targets.resolve(user, projectId, id, input);
  }
  @Get(':targetId/baseline')
  @Header('Cache-Control', 'no-store')
  baseline(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
  ) {
    return this.targets.baseline(user, projectId, id);
  }
  @Post(':targetId/baseline')
  @Header('Cache-Control', 'no-store')
  acceptBaseline(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: AcceptBaselineDto,
  ) {
    return this.targets.acceptBaseline(user, projectId, id, input);
  }
  @Post(':targetId/read')
  @Header('Cache-Control', 'no-store')
  read(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: RevisionDto,
  ) {
    return this.targets.read(user, projectId, id, input.expectedRevision);
  }
  @Put(':targetId')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateTargetDto,
  ) {
    return this.targets.save(
      user,
      projectId,
      input,
      id,
      input.expectedRevision,
    );
  }
  @Delete(':targetId')
  @Header('Cache-Control', 'no-store')
  remove(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('targetId', new ParseUUIDPipe()) id: string,
    @Body() input: RevisionDto,
  ) {
    return this.targets.remove(user, projectId, id, input.expectedRevision);
  }
}
@Module({
  imports: [AuthModule, ProjectsModule, BranchesModule, LocalSyncPreviewModule],
  controllers: [RepositoryTargetsController],
  providers: [RepositoryTargetsService],
})
export class RepositoryTargetsModule {}
