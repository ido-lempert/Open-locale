import { Module } from '@nestjs/common';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({ imports: [AuthModule, ProjectsModule], controllers: [QaController], providers: [QaService] })
export class QaModule {}
