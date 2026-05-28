import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/constants/audit-actions.constant';
import { RegisterDto } from './dto/register.dto';

// How many hours the verify-email token is valid
const VERIFY_TOKEN_EXPIRY_HOURS = 24;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService:  MailService,
    private readonly jwtService:   JwtService,
    private readonly config:       ConfigService,
    private readonly auditService: AuditService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ── Register ─────────────────────────────────────────────────
  async register(dto: RegisterDto, req: Request) {
    // 1 — Create user (UsersService throws ConflictException if email taken)
    const user = await this.usersService.create({
      email:    dto.email.toLowerCase().trim(),
      password: dto.password,
      fullName: dto.fullName.trim(),
    });

    await this.auditService.log({
      action:    AuditAction.USER_REGISTERED,
      userId:    user.id,
      email:     user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata:  { fullName: user.fullName },
    });

    // 2 — Generate JWT verify-email token
    const { token, expiry } = this.buildVerifyToken(user.id, user.email);

    // 3 — Persist token hash on the user record
    await this.usersService.setVerifyToken(user.id, token, expiry);

    // 4 — Build the frontend verification deep-link
    const verifyLink = this.buildVerifyLink(token);

    // 5 — Queue welcome email (fire and forget via BullMQ)
    await this.mailService.queueWelcomeEmail({
      userId:   user.id,
      email:    user.email,
      fullName: user.fullName,
    });

    await this.auditService.log({
      action:    AuditAction.WELCOME_EMAIL_SENT,
      userId:    user.id,
      email:     user.email,
      ipAddress: req.ip,
    });

    // 6 — Queue verification email
    await this.mailService.queueVerificationEmail({
      userId:         user.id,
      email:          user.email,
      fullName:       user.fullName,
      verifyLink,
      expiresInHours: VERIFY_TOKEN_EXPIRY_HOURS,
    });

    await this.auditService.log({
      action:    AuditAction.VERIFICATION_EMAIL_SENT,
      userId:    user.id,
      email:     user.email,
      ipAddress: req.ip,
    });

    this.logger.log(
      `Registration complete for ${user.email} — emails queued`,
      'AuthService',
    );

    return {
      message:
        'Registration successful. Please check your inbox to verify your email address.',
      userId:  user.id,
      email:   user.email,
    };
  }

  // ── Verify Email ─────────────────────────────────────────────
  async verifyEmail(token: string, req: Request) {
    // 1 — Validate token structure via JWT
    let payload: { sub: string; email: string; type: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('jwt.verifyEmailSecret'),
      });
    } catch (err: any) {
      const isExpired = err?.name === 'TokenExpiredError';

      await this.auditService.log({
        action:    isExpired
          ? AuditAction.EXPIRED_VERIFY_TOKEN
          : AuditAction.INVALID_VERIFY_TOKEN,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata:  { reason: err?.message },
      });

      throw isExpired
        ? new UnprocessableEntityException(
            'Verification link has expired. Please request a new one.',
          )
        : new BadRequestException('Invalid verification token.');
    }

    if (payload.type !== 'email-verify') {
      throw new BadRequestException('Invalid token type.');
    }

    // 2 — Find user by stored token (ensures single-use)
    const user = await this.usersService.findByVerifyToken(token);
    if (!user) {
      throw new BadRequestException(
        'Verification token is invalid or has already been used.',
      );
    }

    if (user.isEmailVerified) {
      return { message: 'Email address is already verified. You can log in.' };
    }

    // 3 — Check DB-level expiry (double-guard beyond JWT exp)
    if (user.emailVerifyTokenExpiry && user.emailVerifyTokenExpiry < new Date()) {
      await this.auditService.log({
        action:    AuditAction.EXPIRED_VERIFY_TOKEN,
        userId:    user.id,
        email:     user.email,
        ipAddress: req.ip,
      });
      throw new UnprocessableEntityException(
        'Verification link has expired. Please request a new one.',
      );
    }

    // 4 — Mark verified
    await this.usersService.markEmailVerified(user.id);

    await this.auditService.log({
      action:    AuditAction.EMAIL_VERIFIED,
      userId:    user.id,
      email:     user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.logger.log(`Email verified for ${user.email}`, 'AuthService');

    return {
      message: 'Email verified successfully. Your account is now active.',
      email:   user.email,
    };
  }

  // ── Resend Verification ──────────────────────────────────────
  async resendVerification(email: string, req: Request) {
    const user = await this.usersService.findByEmail(email.toLowerCase().trim());

    // Always return the same response to prevent email enumeration
    const genericResponse = {
      message:
        'If an account with that email exists and is unverified, a new link has been sent.',
    };

    if (!user || user.isEmailVerified) return genericResponse;

    const { token, expiry } = this.buildVerifyToken(user.id, user.email);
    await this.usersService.setVerifyToken(user.id, token, expiry);

    const verifyLink = this.buildVerifyLink(token);

    await this.mailService.queueVerificationEmail({
      userId:         user.id,
      email:          user.email,
      fullName:       user.fullName,
      verifyLink,
      expiresInHours: VERIFY_TOKEN_EXPIRY_HOURS,
    });

    await this.auditService.log({
      action:    AuditAction.VERIFICATION_RESENT,
      userId:    user.id,
      email:     user.email,
      ipAddress: req.ip,
    });

    return genericResponse;
  }

  // ── Private helpers ──────────────────────────────────────────

  private buildVerifyToken(
    userId: string,
    email: string,
  ): { token: string; expiry: Date } {
    const expiresIn = this.config.get<string>(
      'jwt.verifyEmailExpiresIn',
      '24h',
    );

    const token = this.jwtService.sign(
      { sub: userId, email, type: 'email-verify' },
      {
        secret:    this.config.get<string>('jwt.verifyEmailSecret'),
        expiresIn,
      },
    );

    const expiry = new Date();
    expiry.setHours(expiry.getHours() + VERIFY_TOKEN_EXPIRY_HOURS);

    return { token, expiry };
  }

  private buildVerifyLink(token: string): string {
    const base = this.config.get<string>('app.frontendUrl');
    const path = this.config.get<string>('app.frontendVerifyPath');
    return `${base}${path}?token=${token}`;
  }
}
