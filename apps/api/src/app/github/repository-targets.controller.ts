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
} from '@nestjs/common';
import {
  IsInt,
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
  imports: [AuthModule, ProjectsModule, BranchesModule],
  controllers: [RepositoryTargetsController],
  providers: [RepositoryTargetsService],
})
export class RepositoryTargetsModule {}
