import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      // PrismaService is stubbed: this spec covers the controller shape, and
      // the health() query path is verified over real PostgreSQL in
      // scripts/authz-http-test.mjs.
      providers: [AppService, { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } }],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'Hello API' });
    });

    it('health reports ok with the stubbed database up', async () => {
      const appController = app.get<AppController>(AppController);
      await expect(appController.health()).resolves.toEqual({ status: 'ok', db: 'up' });
    });
  });
});
