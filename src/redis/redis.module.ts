import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './services/redis.service';
import { REDIS_CLIENT } from './constants/redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const password = configService.get<string>('REDIS_PASSWORD');
        const username = configService.get<string>('REDIS_USERNAME');
        return new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT', 6379),
          ...(username ? { username } : {}),
          ...(password ? { password } : {}),
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
