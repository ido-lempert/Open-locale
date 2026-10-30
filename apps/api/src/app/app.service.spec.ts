import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      // PrismaService is stubbed: the real query path is verified over real
      // PostgreSQL in scripts/authz-http-test.mjs.
      providers: [AppService, { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } }],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      expect(service.getData()).toEqual({ message: 'Hello API' });
    });

    it('health reports ok when the database answers', async () => {
      await expect(service.health()).resolves.toEqual({ status: 'ok', db: 'up' });
    });

    it('health fails closed when the database is wedged', async () => {
      const prisma = (service as never as { prisma: { $queryRaw: jest.Mock } }).prisma;
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      await expect(service.health()).rejects.toThrow('connection refused');
    });
  });
});
