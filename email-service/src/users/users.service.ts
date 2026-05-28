import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { UsersRepository } from './users.repository';

export interface CreateUserInput {
  email:    string;
  password: string;
  fullName: string;
}

// Safe user shape — never expose passwordHash over the wire
export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const exists = await this.usersRepo.existsByEmail(input.email);
    if (exists) {
      throw new ConflictException(
        'An account with this email address already exists.',
      );
    }

    const saltRounds = this.config.get<number>('app.bcryptSaltRounds', 12);
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const user = await this.usersRepo.create({
      email:        input.email,
      passwordHash,
      fullName:     input.fullName,
    });

    this.logger.log(`User created id=${user.id} email=${user.email}`, 'UsersService');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findByEmail(email);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found.`);
    return user;
  }

  async findByVerifyToken(token: string): Promise<User | null> {
    return this.usersRepo.findByVerifyToken(token);
  }

  async markEmailVerified(id: string): Promise<User> {
    return this.usersRepo.markEmailVerified(id);
  }

  async setVerifyToken(id: string, token: string, expiry: Date): Promise<User> {
    return this.usersRepo.setVerifyToken(id, token, expiry);
  }

  // Strip sensitive fields for API responses
  toSafeUser(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
