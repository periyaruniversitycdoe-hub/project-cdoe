import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config:      ConfigService,
  ) {}

  // ── POST /auth/register ──────────────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 reqs / 60 s per IP
  @ApiOperation({
    summary: 'Register a new university ERP account',
    description:
      'Creates a user, queues a welcome email, and queues an email verification link. Rate-limited to 5 requests per minute per IP.',
  })
  @ApiCreatedResponse({ description: 'Registration successful, verification email sent.' })
  @ApiConflictResponse({ description: 'Email already registered.' })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts.' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ) {
    return this.authService.register(dto, req);
  }

  // ── GET /auth/verify-email?token=xxx ─────────────────────────
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email address via JWT token',
    description:
      'Called when the user clicks the link in the verification email. Marks the account as verified and redirects to the frontend dashboard.',
  })
  @ApiQuery({ name: 'token', description: 'JWT email-verification token from the email link' })
  @ApiOkResponse({ description: 'Email verified — redirects to frontend.' })
  @ApiBadRequestResponse({ description: 'Invalid or expired token.' })
  async verifyEmail(
    @Query('token') token: string,
    @Req()  req: Request,
    @Res()  res: Response,
  ) {
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message:    'Verification token is required.',
      });
    }

    try {
      await this.authService.verifyEmail(token, req);

      // Redirect to frontend success page
      const frontendUrl = this.config.get<string>('app.frontendUrl');
      return res.redirect(
        HttpStatus.FOUND,
        `${frontendUrl}/auth/verified?status=success`,
      );
    } catch (err: any) {
      const frontendUrl = this.config.get<string>('app.frontendUrl');
      const code = err.status ?? 400;
      const msg  = encodeURIComponent(err.message ?? 'Verification failed.');
      return res.redirect(
        HttpStatus.FOUND,
        `${frontendUrl}/auth/verified?status=error&message=${msg}&code=${code}`,
      );
    }
  }

  // ── POST /auth/resend-verification ──────────────────────────
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } }) // 3 reqs / 5 min per IP
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Generates a new verification token and queues a new email. Always returns 200 to prevent email enumeration attacks.',
  })
  @ApiOkResponse({ description: 'Verification email resent (if account exists and is unverified).' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req()  req: Request,
  ) {
    return this.authService.resendVerification(dto.email, req);
  }
}
