import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { envValidationSchema } from './config/env.schema';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { ShortenerModule } from './shortener/shortener.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FallbackModule } from './common/fallback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URL'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..'),
      serveStaticOptions: {
        index: ['index.html'],
        etag: false,
        lastModified: false,
        setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
      },
    }),
    RedisModule,
    HealthModule,
    ShortenerModule,
    AnalyticsModule,
    FallbackModule,
  ],
})
export class AppModule {}
