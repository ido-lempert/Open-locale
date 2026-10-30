import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  // Liveness for container orchestration: proves the process serves HTTP AND
  // can reach the database (a wedged pool must read as down, not up).
  async health(): Promise<{ status: string; db: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
