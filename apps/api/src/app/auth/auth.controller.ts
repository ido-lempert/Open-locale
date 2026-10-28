import {
  Body,
  Controller,
  HttpCode,
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
    return this.auth.createApiToken(user.userId, dto.name, dto.scopes ?? ['read', 'write']);
  }
}
