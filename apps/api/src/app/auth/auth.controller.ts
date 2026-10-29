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
import { CreateApiTokenDto, LoginDto, SignupDto, TotpCodeDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  // 2FA management is session-only, like token management: an API token must
  // not be able to change the account's second factor.
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTotp(@CurrentUser() user: AuthPrincipal) {
    this.requireSession(user);
    return this.auth.setupTotp(user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enableTotp(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpCodeDto) {
    this.requireSession(user);
    return this.auth.enableTotp(user.userId, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disableTotp(@CurrentUser() user: AuthPrincipal, @Body() dto: TotpCodeDto) {
    this.requireSession(user);
    return this.auth.disableTotp(user.userId, dto.code);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async totpStatus(@CurrentUser() user: AuthPrincipal) {
    this.requireSession(user);
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
    return this.auth.listApiTokens(user.userId);
  }

  @Delete('tokens/:id')
  @UseGuards(JwtAuthGuard)
  async revokeToken(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    this.requireSession(user);
    const result = await this.auth.revokeApiToken(user.userId, id);
    if (!result) throw new NotFoundException('Token not found');
    return result;
  }
}
