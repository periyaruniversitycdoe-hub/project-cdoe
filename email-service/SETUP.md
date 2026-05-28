# ERP Email Service — Setup Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (for BullMQ)

## Quick Start

```bash
cd email-service

# 1. Install dependencies
npm install

# 2. Copy and fill environment file
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT secrets, BREVO credentials

# 3. Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate:dev

# 4. Start development server
npm run start:dev
```

Server starts at http://localhost:3000/api/v1  
Swagger UI at http://localhost:3000/api/docs

---

## BREVO SMTP Configuration

| Setting | Value |
|---------|-------|
| Host    | smtp-relay.brevo.com |
| Port    | 587 (STARTTLS) |
| Login   | Your Brevo account email |
| Key     | Set in `.env` as `BREVO_SMTP_KEY` |

---

## API Endpoints

### POST /api/v1/auth/register
Rate-limited: 5 requests / 60 seconds per IP.

**Body:**
```json
{
  "email": "student@example.com",
  "fullName": "Rajesh Kumar",
  "password": "Str0ng@Pass!"
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Please check your inbox to verify your email address.",
  "userId": "clxxx...",
  "email": "student@example.com"
}
```

---

### GET /api/v1/auth/verify-email?token=JWT_TOKEN
Called when user clicks the link in the verification email.  
Redirects to `{FRONTEND_URL}/auth/verified?status=success` on success.  
Redirects to `{FRONTEND_URL}/auth/verified?status=error&message=...` on failure.

---

### POST /api/v1/auth/resend-verification
Rate-limited: 3 requests / 5 minutes per IP.

**Body:**
```json
{ "email": "student@example.com" }
```
Always returns 200 to prevent email enumeration.

---

## Architecture

```
POST /register
    │
    ├─▶ UsersService.create()         — bcrypt hash, Prisma insert
    ├─▶ AuditService.log(USER_REGISTERED)
    ├─▶ AuthService.buildVerifyToken() — JWT signed with verifyEmailSecret
    ├─▶ UsersService.setVerifyToken()  — stored in DB for single-use
    │
    ├─▶ MailService.queueWelcomeEmail()      ─▶ BullMQ
    ├─▶ AuditService.log(WELCOME_EMAIL_SENT)
    ├─▶ MailService.queueVerificationEmail() ─▶ BullMQ
    └─▶ AuditService.log(VERIFICATION_EMAIL_SENT)

BullMQ Worker (MailProcessor)
    ├─▶ SEND_WELCOME_EMAIL      → Nodemailer + welcome.hbs
    └─▶ SEND_VERIFICATION_EMAIL → Nodemailer + verify-email.hbs
        (3–5 retries, exponential back-off)

GET /verify-email?token=...
    ├─▶ JWT.verify(token, verifyEmailSecret)
    ├─▶ UsersService.findByVerifyToken(token)  — single-use check
    ├─▶ check DB expiry
    ├─▶ UsersService.markEmailVerified()
    ├─▶ AuditService.log(EMAIL_VERIFIED)
    └─▶ 302 redirect → frontend
```

---

## Folder Structure

```
email-service/
├── prisma/
│   └── schema.prisma              # User + AuditLog models
├── src/
│   ├── main.ts                    # Bootstrap
│   ├── app.module.ts              # Root module
│   ├── config/                    # Typed config namespaces
│   │   ├── app.config.ts
│   │   ├── mail.config.ts
│   │   ├── jwt.config.ts
│   │   └── redis.config.ts
│   ├── common/
│   │   ├── constants/
│   │   │   ├── audit-actions.constant.ts
│   │   │   └── queue.constant.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   └── logger/
│   │       └── winston.logger.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── audit/
│   │   ├── audit.module.ts
│   │   └── audit.service.ts       # Logs USER_REGISTERED, EMAIL_VERIFIED, etc.
│   ├── mail/
│   │   ├── mail.module.ts         # MailerModule + BullMQ config
│   │   ├── mail.service.ts        # Queue jobs
│   │   ├── mail.processor.ts      # BullMQ worker
│   │   ├── interfaces/
│   │   │   └── mail-job.interface.ts
│   │   └── templates/
│   │       ├── welcome.hbs        # Responsive welcome email
│   │       └── verify-email.hbs   # Responsive verification email
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts       # bcrypt hashing
│   │   └── users.repository.ts    # Prisma queries
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts     # /register, /verify-email, /resend-verification
│       ├── auth.service.ts        # Registration + verification logic
│       ├── dto/
│       │   ├── register.dto.ts
│       │   └── resend-verification.dto.ts
│       └── strategies/
│           └── jwt.strategy.ts
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
└── tsconfig.json
```
