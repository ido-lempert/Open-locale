import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthPrincipal } from './auth.service';

// Runs AFTER JwtAuthGuard: branch management mutates project structure and is
// limited to signed-in session principals. API tokens (including write-scope
// ones) authenticate fine for keys/import/export with ?branch=, but must not
// create, delete, merge, or even list branches - a leaked CI token should not
// be able to restructure a project.
@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    if (request.user?.via !== 'jwt') {
      throw new ForbiddenException('Branch management requires a signed-in session, not an API token');
    }
    return true;
  }
}
