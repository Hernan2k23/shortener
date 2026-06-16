import { ClicksQueueService } from '../services/clicks-queue.service';
import type { ClickPayload } from '../../analytics/repositories/click.repository';

const makeQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });
const makeClicksQueueService = () => {
  const queue = makeQueue();
  const sut = new ClicksQueueService(queue as never);
  return { sut, queue };
};

const payload: ClickPayload = {
  eventId: '11111111-1111-1111-1111-111111111111',
  code: 'abc',
  ts: '2026-06-16T00:00:00.000Z',
  ip: '1.1.1.1',
  ua: 'ua/1',
};

const flushRejection = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe('ClicksQueueService', () => {
  describe('enqueueClick', () => {
    it('hands the payload to the queue under the "click" job name', () => {
      const { sut, queue } = makeClicksQueueService();

      sut.enqueueClick(payload);

      expect(queue.add).toHaveBeenCalledWith('click', payload, expect.any(Object));
    });

    it('hands the payload to the queue with the configured retry/retention options', () => {
      const { sut, queue } = makeClicksQueueService();

      sut.enqueueClick(payload);

      expect(queue.add).toHaveBeenCalledWith('click', payload, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: 100,
      });
    });

    it('when queue.add rejects, does not throw synchronously', () => {
      const queue = { add: jest.fn().mockReturnValue(Promise.reject(new Error('redis down'))) };
      const sut = new ClicksQueueService(queue as never);

      expect(() => sut.enqueueClick(payload)).not.toThrow();
    });

    it('when queue.add rejects, swallows the rejection and never rethrows', async () => {
      const queue = { add: jest.fn().mockReturnValue(Promise.reject(new Error('redis down'))) };
      const sut = new ClicksQueueService(queue as never);

      sut.enqueueClick(payload);
      await flushRejection();

      expect(queue.add).toHaveBeenCalledTimes(1);
    });
  });
});
