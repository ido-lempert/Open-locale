import { Controller, Get, Header } from '@nestjs/common';
import { OPENAPI } from './openapi';
import { DOCS_PAGE } from './docs-page';

// Public API documentation. The spec describes the public v1 surface only;
// it carries no user data, so it is served without authentication, matching
// how Lokalise publishes its API reference.
@Controller()
export class DocsController {
  @Get('openapi.json')
  spec() {
    return OPENAPI;
  }

  // Rendered reference for humans: same spec, zero-dependency HTML page.
  // Public like the spec itself; carries no user data.
  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  docs() {
    return DOCS_PAGE;
  }
}
