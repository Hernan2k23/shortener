import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../constants/redis.constants';

export const NEGATIVE_SENTINEL = '__NEG__';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly ttlSeconds: number;
  private readonly negativeTtlSeconds: number;
  private readonly jitterSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<number>('CACHE_TTL_SECONDS', 3600);
    this.negativeTtlSeconds = configService.get<number>(
      'NEGATIVE_CACHE_TTL_SECONDS',
      30,
    );
    this.jitterSeconds = Math.max(1, Math.floor(this.ttlSeconds * 0.1));
  }

  private keyFor(code: string): string {
    return `url:${code}`;
  }

  private negativeKeyFor(code: string): string {
    return `url:none:${code}`;
  }

  async getCode(code: string): Promise<string | null> {
    try {
      const [positive, negative] = await this.client.mget(
        this.keyFor(code),
        this.negativeKeyFor(code),
      );
      if (positive !== null) return positive;
      if (negative !== null) return NEGATIVE_SENTINEL;
      return null;
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for getCode(${code}), falling through to DB — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async setCode(code: string, originalUrl: string): Promise<void> {
    const ttl =
      this.ttlSeconds + Math.floor(Math.random() * this.jitterSeconds);
    await this.client.set(this.keyFor(code), originalUrl, 'EX', ttl);
  }

  async setNegative(code: string): Promise<void> {
    await this.client.set(
      this.negativeKeyFor(code),
      '1',
      'EX',
      this.negativeTtlSeconds,
    );
  }

  async ping(): Promise<boolean> {
    try {
      const r = await this.client.ping();
      return r === 'PONG';
    } catch (e) {
      this.logger.warn('redis ping failed', e as Error);
      return false;
    }
  }
}
