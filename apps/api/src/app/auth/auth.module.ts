import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionOnlyGuard } from './session-only.guard';
import { OidcService } from './oidc.service';
import { DEV_FALLBACK_JWT_SECRET } from './dev-secret';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OidcService, JwtAuthGuard, SessionOnlyGuard],
  exports: [AuthService, JwtAuthGuard, SessionOnlyGuard],
})
export class AuthModule {}
