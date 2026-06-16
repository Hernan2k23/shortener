import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ClickConsumerService } from './services/click-consumer.service';
import { ClickRepository } from './repositories/click.repository';
import { ClickStatsRepository } from './repositories/click-stats.repository';
import { ClickEvent, ClickEventSchema } from './schemas/click.schema';
import { ClickStats, ClickStatsSchema } from './schemas/click-stats.schema';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClickEvent.name, schema: ClickEventSchema },
      { name: ClickStats.name, schema: ClickStatsSchema },
    ]),
    QueueModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ClickRepository,
    ClickStatsRepository,
    ClickConsumerService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
