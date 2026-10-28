import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DEV_FALLBACK_JWT_SECRET } from './app/auth/dev-secret';

const isLoopbackHost = (host: string) =>
  ['127.0.0.1', '::1', 'localhost'].includes(host);

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }
  const host = process.env.HOST;
  // Development default: loopback only. Listening beyond localhost requires an
  // explicit HOST and a real JWT_SECRET - setting the variable to the known
  // built-in value does not count as configuring a secret.
  if (
    host &&
    !isLoopbackHost(host) &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_FALLBACK_JWT_SECRET)
  ) {
    throw new Error(
      `Refusing to bind ${host}: a non-loopback listener needs an explicit non-default JWT_SECRET (the built-in development secret is not acceptable).`,
    );
  }
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;
  app.enableCors({ origin: corsOrigin, credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: 'embed/projects/:projectId', method: RequestMethod.GET },
      { path: 'embed/frame.js', method: RequestMethod.GET },
      { path: 'embed/frame.css', method: RequestMethod.GET },
    ],
  });
  const port = process.env.PORT || 3000;
  if (host) {
    await app.listen(port, host);
  } else if (process.env.NODE_ENV === 'production') {
    await app.listen(port);
  } else {
    await app.listen(port, '127.0.0.1');
  }
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(
    `Application is running on: http://${host ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')}:${port}/${globalPrefix}`,
  );
}

bootstrap();
