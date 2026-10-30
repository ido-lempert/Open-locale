import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SamlService } from './saml.service';
import { AuthService, AuthPrincipal } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

// SAML SP endpoints. login/acs/complete are unauthenticated by nature (they
// ESTABLISH the session); the response validation itself is the
// authentication boundary. start-link is session-only with fresh auth.
@Controller('auth/saml')
export class SamlController {
  constructor(private readonly saml: SamlService, private readonly auth: AuthService) {}

  @Get('login')
  login() {
    return this.saml.login();
  }

  @Get('metadata')
  @Header('content-type', 'application/samlmetadata+xml')
  metadata() {
    return this.saml.metadata();
  }

  // Linking requires fresh auth: the current password, and the resulting
  // RelayState token is bound to this account AND its current authEpoch.
  @Post('start-link')
  @UseGuards(JwtAuthGuard)
  async startLink(@CurrentUser() user: AuthPrincipal, @Body() body: { password?: string }) {
    if (user.via !== 'jwt') throw new ForbiddenException('Linking requires a signed-in session');
    if (typeof body?.password !== 'string') throw new BadRequestException('password is required');
    await this.auth.requirePasswordForUser(user.userId, body.password);
    const epoch = await this.auth.sessionEpoch(user.userId);
    return this.saml.startLink(user.userId, epoch);
  }

  @Post('acs')
  @HttpCode(200)
  acs(@Body('SAMLResponse') samlResponse?: string, @Body('RelayState') relayState?: string) {
    if (typeof samlResponse !== 'string' || !samlResponse) {
      throw new BadRequestException('SAMLResponse is required');
    }
    if (relayState !== undefined && typeof relayState !== 'string') {
      throw new BadRequestException('RelayState must be a string');
    }
    return this.saml.acs(samlResponse, relayState);
  }

  @Post('complete')
  @HttpCode(200)
  complete(@Body() body: { pendingToken?: string; totpCode?: string }) {
    if (typeof body?.pendingToken !== 'string' || typeof body?.totpCode !== 'string') {
      throw new BadRequestException('pendingToken and totpCode are required');
    }
    return this.saml.complete(body.pendingToken, body.totpCode);
  }
}
