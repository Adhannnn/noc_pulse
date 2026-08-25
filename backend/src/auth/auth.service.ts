// backend/src/auth/auth.service.ts
import { ConflictException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.seedInitialAdmin();
  }

  // Seed Admin default jika belum ada user terdaftar sama sekali
  private async seedInitialAdmin() {
    try {
      const userCount = await this.prisma.user.count();
      if (userCount === 0) {
        const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@pulsenoc.local';
        const defaultAdminPass = process.env.ADMIN_PASSWORD || 'admin123456';
        const hashedPassword = await bcrypt.hash(defaultAdminPass, 10);

        await this.prisma.user.create({
          data: {
            name: 'PulseNOC System Admin',
            email: defaultAdminEmail,
            password: hashedPassword,
            role: UserRole.ADMIN,
          },
        });

        this.logger.log(`=======================================================`);
        this.logger.log(`INITIAL ADMIN SEEDED SUCCESSFULLY!`);
        this.logger.log(`Email:    ${defaultAdminEmail}`);
        this.logger.log(`Password: ${defaultAdminPass}`);
        this.logger.log(`=======================================================`);
      }
    } catch (error) {
      this.logger.error('Failed to seed initial admin', error);
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        role: dto.role || UserRole.OPERATOR,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return newUser;
  }

  async updateUserRole(id: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ConflictException('Cannot change role of the last remaining Admin account');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const adminCount = await this.prisma.user.count({
      where: { role: UserRole.ADMIN },
    });

    if (user.role === UserRole.ADMIN && adminCount <= 1) {
      throw new ConflictException('Cannot delete the last remaining Admin account');
    }

    return this.prisma.user.delete({
      where: { id },
      select: { id: true, email: true },
    });
  }
}
