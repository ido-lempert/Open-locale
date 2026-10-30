import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { AppModule } from './app/app.module';
import { DEV_FALLBACK_JWT_SECRET } from './app/auth/dev-secret';
import { DEV_FALLBACK_TOTP_KEY } from './app/auth/totp-crypto';

const isLoopbackHost = (host: string) =>
  ['127.0.0.1', '::1', 'localhost'].includes(host);

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }
  const host = process.env.HOST;
  const totpKey = process.env.TOTP_ENCRYPTION_KEY;
  const totpKeyWeak = !totpKey || totpKey.length < 16;
  // Setting the variable to the well-known built-in value is not configuring
  // a key - reject it everywhere, at startup, whatever the environment.
  if (totpKey === DEV_FALLBACK_TOTP_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY must not be the built-in development value');
  }
  if (process.env.NODE_ENV === 'production' && totpKeyWeak) {
    throw new Error(
      'A strong explicit TOTP_ENCRYPTION_KEY (>=16 chars, not the built-in development value) is required in production - failing closed at startup.',
    );
  }
  // Development default: loopback only. Listening beyond localhost requires an
  // explicit HOST and a real JWT_SECRET - setting the variable to the known
  // built-in value does not count as configuring a secret.
  if (
    host &&
    !isLoopbackHost(host) &&
    (!process.env.JWT_SECRET ||
      process.env.JWT_SECRET === DEV_FALLBACK_JWT_SECRET ||
      totpKeyWeak)
  ) {
    throw new Error(
      `Refusing to bind ${host}: a non-loopback listener needs explicit non-default JWT_SECRET and TOTP_ENCRYPTION_KEY (built-in development values are not acceptable).`,
    );
  }
  const app = await NestFactory.create(AppModule);
  // Binary zip bodies for bundle import only; the JSON parser skips this
  // content type, and the 40 MiB cap bounds allocation (archive budget is 32 MiB).
  app.use(raw({ type: 'application/zip', limit: 40 * 1024 * 1024 }));
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;
  app.enableCors({ origin: corsOrigin, credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: 'embed/projects/:projectId', method: RequestMethod.GET },
      { path: 'embed/frame.js', method: RequestMethod.GET },
      { path: 'embed/host.js', method: RequestMethod.GET },
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
