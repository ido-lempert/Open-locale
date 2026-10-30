import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { SamlService } from './saml.service';

// SAML SP endpoints. Unauthenticated by nature (they ESTABLISH the session);
// the response validation itself is the authentication boundary.
@Controller('auth/saml')
export class SamlController {
  constructor(private readonly saml: SamlService) {}

  @Get('login')
  login() {
    return this.saml.login();
  }

  @Post('acs')
  acs(@Body('SAMLResponse') samlResponse?: string) {
    if (typeof samlResponse !== 'string' || !samlResponse) {
      throw new BadRequestException('SAMLResponse is required');
    }
    return this.saml.acs(samlResponse);
  }

  @Post('complete')
  complete(@Body() body: { pendingToken?: string; totpCode?: string }) {
    if (typeof body?.pendingToken !== 'string' || typeof body?.totpCode !== 'string') {
      throw new BadRequestException('pendingToken and totpCode are required');
    }
    return this.saml.complete(body.pendingToken, body.totpCode);
  }
}
