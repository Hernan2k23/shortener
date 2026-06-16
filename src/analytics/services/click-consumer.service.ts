import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { CLICK_QUEUE } from '../../queue/constants/click-queue.constants';
import { ClickRepository, ClickPayload } from '../repositories/click.repository';
import { ClickStatsRepository } from '../repositories/click-stats.repository';


@Injectable()
@Processor(CLICK_QUEUE, { concurrency: 4 })
export class ClickConsumerService
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ClickConsumerService.name);

  constructor(
    @InjectQueue(CLICK_QUEUE) private readonly queue: Queue,
    private readonly clicks: ClickRepository,
    private readonly stats: ClickStatsRepository,
  ) {
    super();
  }

  async process(job: Job<ClickPayload>): Promise<void> {
    let isDuplicate = false;

    try {
      await this.clicks.create(job.data);
    } catch (e: unknown) {
      const code =
        typeof e === 'object' && e !== null && (e as { code?: number }).code;
      if (code === 11000) {
        isDuplicate = true;
      } else {
        this.logger.error(`click insert failed: ${(e as Error).message}`);
        throw e;
      }
    }

    if (!isDuplicate) {
      try {
        await this.stats.incrementStats(job.data.code, new Date(job.data.ts));
      } catch (e) {
        this.logger.warn(
          `stats increment failed for ${job.data.code}: ${(e as Error).message}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
