import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, AuthPrincipal } from './auth.service';
import { CreateApiTokenDto, LoginDto, OidcCallbackDto, OidcCompleteDto, SignupDto, TotpCodeDto, TotpSetupDto } from './dto';
import { OidcService } from './oidc.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly oidc: OidcService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto.email, dto.password, dto.displayName);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const result = await this.auth.login(dto.email, dto.password, dto.totpCode);
    if (!result) throw new UnauthorizedException('Invalid email or password');
    return result;
  }

  // OIDC groundwork (local mock issuer only - no external IdP enrolled).
  // start returns the authorization URL; start-link binds an identity to the
  // signed-in account (session-only). callback exchanges code+state; complete
  // finishes the local-2FA step for accounts that have TOTP enabled.
  @Get('oidc/info')
  oidcInfo() { return { configured: !!process.env.OIDC_ISSUER }; }

  @Get('oidc/start')
  async oidcStart() {
    return this.oidc.start(null);
  }

  // Linking requires fresh auth: the current password, and the resulting
  // state is bound to this account AND its current authEpoch.
  @Post('oidc/start-link')
  @UseGuards(JwtAuthGuard)
  async oidcStartLink(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpSetupDto) {
    this.requireSession(user);
    await this.auth.requirePasswordForUser(user.userId, dto.password);
    const epoch = await this.auth.sessionEpoch(user.userId);
    return this.oidc.start(user.userId, epoch);
  }

  @Post('oidc/callback')
  @HttpCode(200)
  async oidcCallback(@Body() dto: OidcCallbackDto) {
    return this.oidc.callback(dto.code, dto.state);
  }

  @Post('oidc/complete')
  @HttpCode(200)
  async oidcComplete(@Body() dto: OidcCompleteDto) {
    return this.oidc.complete(dto.pendingToken, dto.totpCode);
  }

  // 2FA management is session-only, like token management: an API token must
  // not be able to change the account's second factor.
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTotp(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpSetupDto) {
    this.requireSession(user);
    return this.auth.setupTotp(user.userId, dto.password);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enableTotp(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpCodeDto) {
    this.requireSession(user);
    return this.auth.enableTotp(user.userId, dto.password, dto.code);
  }

  // Disable + status are step-up-protected: a session issued before the
  // account had 2FA must re-authenticate with the second factor first.
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disableTotp(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpCodeDto) {
    this.requireSession(user);
    await this.auth.requireStepUp(user.userId, user);
    return this.auth.disableTotp(user.userId, dto.password, dto.code);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async totpStatus(@CurrentUser() user: AuthPrincipal) {
    this.requireSession(user);
    await this.auth.requireStepUp(user.userId, user);
    return this.auth.totpStatus(user.userId);
  }

  // Token management is session-only: an API token must not be able to mint,
  // enumerate or revoke other tokens, or a leaked read+write token could mint
  // itself successors and persist beyond revocation of the leaked one alone.
  private requireSession(user: AuthPrincipal) {
    if (user.via !== 'jwt') {
      throw new ForbiddenException('Token management requires a signed-in session');
    }
  }

  @Post('tokens')
  @UseGuards(JwtAuthGuard)
  async createToken(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateApiTokenDto) {
    this.requireSession(user);
    await this.auth.requireStepUp(user.userId, user);
    const scopes = dto.scopes?.length ? dto.scopes : ['read', 'write'];
    const valid = scopes.every((s) => s === 'read' || s === 'write');
    if (!valid || !scopes.includes('read')) {
      throw new BadRequestException('Scopes must be read and/or write');
    }
    let expiresAt: Date | undefined;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be a future ISO timestamp');
      }
    }
    return this.auth.createApiToken(user.userId, dto.name, scopes, expiresAt);
  }

  @Get('tokens')
  @UseGuards(JwtAuthGuard)
  async listTokens(@CurrentUser() user: AuthPrincipal) {
    this.requireSession(user);
    await this.auth.requireStepUp(user.userId, user);
    return this.auth.listApiTokens(user.userId);
  }

  @Delete('tokens/:id')
  @UseGuards(JwtAuthGuard)
  async revokeToken(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    this.requireSession(user);
    await this.auth.requireStepUp(user.userId, user);
    const result = await this.auth.revokeApiToken(user.userId, id);
    if (!result) throw new NotFoundException('Token not found');
    return result;
  }
}
