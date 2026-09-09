import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './refresh-token.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(dto.email, passwordHash);

    const tokens = await this.issueTokens(user.id);
    return { ...tokens, user: { id: user.id, email: user.email } };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id);
    return { ...tokens, user: { id: user.id, email: user.email } };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ротация: старый refresh-токен становится бесполезен сразу после использования
    await this.refreshTokensRepository.delete(stored.id);

    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.refreshTokensRepository.delete({ tokenHash });
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: userId },
      process.env.JWT_SECRET as string,
      {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as StringValue,
      },
    );

    const refreshToken = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30),
    );

    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        userId,
        tokenHash,
        expiresAt,
      }),
    );

    return { accessToken, refreshToken };
  }
}
