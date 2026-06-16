import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../../redis/services/redis.service';
import { CodeGeneratorService } from '../../code-generation/services/code-generator.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly redis: RedisService,
    private readonly codeGen: CodeGeneratorService,
  ) {}

  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async ready(): Promise<{
    status: 'ok' | 'degraded';
    mongo: boolean;
    redis: boolean;
    codePool: {
      poolDepth: number;
      poolSize: number;
      fallbackCount: number;
      refillSuccessCount: number;
      refillFailureCount: number;
    };
  }> {
    const [mongoOk, redisOk] = await Promise.all([
      Promise.resolve(this.checkMongo()),
      this.redis.ping(),
    ]);

    return {
      status: mongoOk && redisOk ? 'ok' : 'degraded',
      mongo: mongoOk,
      redis: redisOk,
      codePool: this.codeGen.getMetrics(),
    };
  }

  private checkMongo(): boolean {
    try {
      return Number(this.mongo.readyState) === 1;
    } catch (e) {
      this.logger.warn('mongo ping failed', e as Error);
      return false;
    }
  }
}
