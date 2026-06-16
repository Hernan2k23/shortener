import { ClickStatsRepository } from '../repositories/click-stats.repository';

const makeModel = () => {
  const exec = jest.fn();
  const lean = jest.fn().mockReturnValue({ exec });
  const findOne = jest.fn().mockReturnValue({ lean });
  const updateOne = jest.fn().mockResolvedValue(undefined);
  return { findOne, lean, exec, updateOne };
};

const makeClickStatsRepository = () => {
  const model = makeModel();
  const sut = new ClickStatsRepository(model as never);
  return { sut, model };
};

describe('ClickStatsRepository', () => {
  describe('incrementStats', () => {
    it('runs an atomic upsert with $inc and $max', async () => {
      const { sut, model } = makeClickStatsRepository();
      const clickTs = new Date('2026-06-16T00:00:00.000Z');

      await sut.incrementStats('abc', clickTs);

      expect(model.updateOne).toHaveBeenCalledWith(
        { code: 'abc' },
        {
          $inc: { totalClicks: 1 },
          $max: { lastClickAt: clickTs },
          $setOnInsert: { code: 'abc' },
        },
        { upsert: true },
      );
    });
  });

  describe('getStats', () => {
    it('on a hit, returns the row mapped to code/totalClicks/lastClickAt', async () => {
      const { sut, model } = makeClickStatsRepository();
      const lastClickAt = new Date('2026-06-16T00:00:00.000Z');
      model.exec.mockResolvedValue({ code: 'abc', totalClicks: 5, lastClickAt });

      const result = await sut.getStats('abc');

      expect(result).toEqual({ code: 'abc', totalClicks: 5, lastClickAt });
    });

    it('on a miss, returns null', async () => {
      const { sut, model } = makeClickStatsRepository();
      model.exec.mockResolvedValue(null);

      const result = await sut.getStats('missing');

      expect(result).toBeNull();
    });
  });
});
