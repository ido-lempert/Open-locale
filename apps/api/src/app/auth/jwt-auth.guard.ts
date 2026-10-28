import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, AuthPrincipal } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      method?: string;
      user?: AuthPrincipal;
    }>();
    const header = request.headers['authorization'];
    const apiKey = request.headers['x-api-key'];

    let principal: AuthPrincipal | null = null;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      principal = await this.auth.verifyAccessToken(header.slice(7));
    } else if (typeof apiKey === 'string' && apiKey.length > 0) {
      principal = await this.auth.verifyApiToken(apiKey);
    }
    if (!principal) {
      throw new UnauthorizedException('Valid Bearer token or X-Api-Key required');
    }
    const method = (request.method ?? 'GET').toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (principal.via === 'api-token' && !isRead && !(principal.scopes ?? []).includes('write')) {
      throw new ForbiddenException('This API token is read-only');
    }
    request.user = principal;
    return true;
  }
}
