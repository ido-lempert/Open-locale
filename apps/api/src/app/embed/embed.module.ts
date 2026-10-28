import { Module } from '@nestjs/common';
import { EmbedController } from './embed.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmbedController],
})
export class EmbedModule {}
