import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, AuthPrincipal } from './auth.service';
import { CreateApiTokenDto, LoginDto, SignupDto } from './dto';
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
    const result = await this.auth.login(dto.email, dto.password);
    if (!result) throw new UnauthorizedException('Invalid email or password');
    return result;
  }

  @Post('tokens')
  @UseGuards(JwtAuthGuard)
  async createToken(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateApiTokenDto) {
    const scopes = dto.scopes?.length ? dto.scopes : ['read', 'write'];
    const valid = scopes.every((s) => s === 'read' || s === 'write');
    if (!valid || !scopes.includes('read')) {
      throw new BadRequestException('Scopes must be read and/or write');
    }
    return this.auth.createApiToken(user.userId, dto.name, scopes);
  }

  @Get('tokens')
  @UseGuards(JwtAuthGuard)
  async listTokens(@CurrentUser() user: AuthPrincipal) {
    return this.auth.listApiTokens(user.userId);
  }

  @Delete('tokens/:id')
  @UseGuards(JwtAuthGuard)
  async revokeToken(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    const result = await this.auth.revokeApiToken(user.userId, id);
    if (!result) throw new NotFoundException('Token not found');
    return result;
  }
}
