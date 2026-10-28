import { Controller, Get } from '@nestjs/common';
import { OPENAPI } from './openapi';

// Public API documentation. The spec describes the public v1 surface only;
// it carries no user data, so it is served without authentication, matching
// how Lokalise publishes its API reference.
@Controller()
export class DocsController {
  @Get('openapi.json')
  spec() {
    return OPENAPI;
  }
}
