import { Job } from 'bullmq';
import { ClickConsumerService } from '../services/click-consumer.service';
import type { ClickPayload } from '../repositories/click.repository';

const makeJob = (data: ClickPayload): Job<ClickPayload> =>
  ({ data } as unknown as Job<ClickPayload>);

const makeClickConsumer = () => {
  const clicks = { create: jest.fn() };
  const stats = { incrementStats: jest.fn() };
  const queue = { close: jest.fn().mockResolvedValue(undefined) };
  const sut = new ClickConsumerService(queue as never, clicks as never, stats as never);
  return { sut, clicks, stats, queue };
};

const payload: ClickPayload = {
  eventId: '11111111-1111-1111-1111-111111111111',
  code: 'abc',
  ts: '2026-06-16T00:00:00.000Z',
  ip: '1.1.1.1',
  ua: 'ua/1',
};

describe('ClickConsumerService', () => {
  describe('process', () => {
    it('on a new click, inserts the click via the repository', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      clicks.create.mockResolvedValue(undefined);
      stats.incrementStats.mockResolvedValue(undefined);

      await sut.process(makeJob(payload));

      expect(clicks.create).toHaveBeenCalledWith(payload);
    });

    it('on a new click, increments the stats counter for the click code', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      clicks.create.mockResolvedValue(undefined);
      stats.incrementStats.mockResolvedValue(undefined);

      await sut.process(makeJob(payload));

      expect(stats.incrementStats).toHaveBeenCalledWith('abc', new Date(payload.ts));
    });

    it('on a new click, persists the click before incrementing stats (ordering)', async () => {
      const order: string[] = [];
      const clicks = { create: jest.fn(() => { order.push('create'); return Promise.resolve(); }) };
      const stats = { incrementStats: jest.fn(() => { order.push('stats'); return Promise.resolve(); }) };
      const queue = { close: jest.fn().mockResolvedValue(undefined) };
      const sut = new ClickConsumerService(queue as never, clicks as never, stats as never);

      await sut.process(makeJob(payload));

      expect(order).toEqual(['create', 'stats']);
    });

    it('on a duplicate-key error, treats the click as already persisted and does NOT increment stats', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      clicks.create.mockRejectedValue(duplicate);

      await sut.process(makeJob(payload));

      expect(stats.incrementStats).not.toHaveBeenCalled();
    });

    it('on a non-duplicate insert error, rethrows the original error', async () => {
      const { sut, clicks } = makeClickConsumer();
      const boom = new Error('mongo down');
      clicks.create.mockRejectedValue(boom);

      await expect(sut.process(makeJob(payload))).rejects.toBe(boom);
    });

    it('on a non-duplicate insert error, does NOT touch stats', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      const boom = new Error('mongo down');
      clicks.create.mockRejectedValue(boom);

      await sut.process(makeJob(payload)).catch(() => undefined);

      expect(stats.incrementStats).not.toHaveBeenCalled();
    });

    it('when stats increment fails after a successful insert, resolves cleanly', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      clicks.create.mockResolvedValue(undefined);
      stats.incrementStats.mockRejectedValue(new Error('stats write failed'));

      await expect(sut.process(makeJob(payload))).resolves.toBeUndefined();
    });

    it('when stats increment fails after a successful insert, still persisted the click', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      clicks.create.mockResolvedValue(undefined);
      stats.incrementStats.mockRejectedValue(new Error('stats write failed'));

      await sut.process(makeJob(payload));

      expect(clicks.create).toHaveBeenCalledWith(payload);
    });

    it('when stats increment fails after a successful insert, still attempted the stats call', async () => {
      const { sut, clicks, stats } = makeClickConsumer();
      clicks.create.mockResolvedValue(undefined);
      stats.incrementStats.mockRejectedValue(new Error('stats write failed'));

      await sut.process(makeJob(payload));

      expect(stats.incrementStats).toHaveBeenCalledWith('abc', new Date(payload.ts));
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the queue', async () => {
      const { sut, queue } = makeClickConsumer();

      await sut.onModuleDestroy();

      expect(queue.close).toHaveBeenCalled();
    });
  });
});
