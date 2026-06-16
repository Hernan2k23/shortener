import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';

const makeClicksQueue = () => ({ enqueueClick: jest.fn() });
const makeClickStatsRepo = () => ({ incrementStats: jest.fn(), getStats: jest.fn() });

const makeAnalyticsService = () => {
  const clicksQueue = makeClicksQueue();
  const stats = makeClickStatsRepo();
  const sut = new AnalyticsService(clicksQueue as any, stats as any);
  return { sut, clicksQueue, stats };
};

describe('AnalyticsService', () => {
  describe('recordClick', () => {
    it('hands the payload off to the clicks queue', () => {
      const { sut, clicksQueue } = makeAnalyticsService();
      const payload = {
        eventId: '11111111-1111-1111-1111-111111111111',
        code: 'abc',
        ts: '2026-06-16T00:00:00.000Z',
        ip: '1.1.1.1',
        ua: 'ua/1',
      };

      sut.recordClick(payload);

      expect(clicksQueue.enqueueClick).toHaveBeenCalledWith(payload);
    });
  });

  describe('getStats', () => {
    it('on a hit, returns code, totalClicks, and lastClick mapped from the row', async () => {
      const { sut, stats } = makeAnalyticsService();
      const lastClick = new Date('2026-06-16T12:00:00.000Z');
      stats.getStats.mockResolvedValue({ code: 'abc', totalClicks: 42, lastClickAt: lastClick });

      const result = await sut.getStats('abc');

      expect(result).toEqual({ code: 'abc', totalClicks: 42, lastClick });
    });

    it('on a miss, throws NotFoundException', async () => {
      const { sut, stats } = makeAnalyticsService();
      stats.getStats.mockResolvedValue(null);

      await expect(sut.getStats('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
