import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByVerifyToken(token: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { emailVerifyToken: token } });
  }

  async markEmailVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        isEmailVerified:        true,
        emailVerifyToken:       null,
        emailVerifyTokenExpiry: null,
      },
    });
  }

  async setVerifyToken(
    id: string,
    token: string,
    expiry: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        emailVerifyToken:       token,
        emailVerifyTokenExpiry: expiry,
      },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }
}
