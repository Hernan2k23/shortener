import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { CLICK_QUEUE } from './constants/click-queue.constants';
import { ClicksQueueService } from './services/clicks-queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const password = configService.get<string>('REDIS_PASSWORD');
        const username = configService.get<string>('REDIS_USERNAME');
        return {
          connection: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT', 6379),
            ...(username ? { username } : {}),
            ...(password ? { password } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CLICK_QUEUE }),
    BullBoardModule.forFeature({
      name: CLICK_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [ClicksQueueService],
  exports: [ClicksQueueService, BullModule],
})
export class QueueModule {}
