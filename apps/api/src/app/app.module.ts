import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { KeysModule } from './keys/keys.module';
import { TranslationsModule } from './translations/translations.module';
import { ActivityModule } from './activity/activity.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, KeysModule, TranslationsModule, ActivityModule, TasksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
