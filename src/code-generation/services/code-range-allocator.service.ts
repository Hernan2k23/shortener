import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/constants/redis.constants';

@Injectable()
export class CodeRangeAllocatorService {
  private static readonly KEY = 'shortener:code_offset';
  private readonly logger = new Logger(CodeRangeAllocatorService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async claimRange(size: number): Promise<{ start: number; size: number }> {
    const end = await this.redis.incrby(CodeRangeAllocatorService.KEY, size);
    return { start: end - size, size };
  }
}
