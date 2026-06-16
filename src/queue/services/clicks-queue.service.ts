import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CLICK_QUEUE } from '../constants/click-queue.constants';
import type { ClickPayload } from '../../analytics/repositories/click.repository';

@Injectable()
export class ClicksQueueService {
  private readonly logger = new Logger(ClicksQueueService.name);

  constructor(
    @InjectQueue(CLICK_QUEUE) private readonly queue: Queue<ClickPayload>,
  ) {}

  enqueueClick(payload: ClickPayload): void {
    this.queue
      .add('click', payload, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: 100,
      })
      .catch((err: unknown) =>
        this.logger.error(
          `enqueue failed: ${(err as Error)?.message ?? String(err)}`,
        ),
      );
  }
}
