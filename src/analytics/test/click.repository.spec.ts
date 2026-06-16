import { ClickRepository } from '../repositories/click.repository';

const makeModel = () => {
  const exec = jest.fn();
  const aggregate = jest.fn().mockReturnValue({ exec });
  const create = jest.fn();
  return { create, aggregate, exec };
};

const makeClickRepository = () => {
  const model = makeModel();
  const sut = new ClickRepository(model as never);
  return { sut, model };
};

describe('ClickRepository', () => {
  describe('create', () => {
    it('converts the ISO ts string into a Date', async () => {
      const { sut, model } = makeClickRepository();
      model.create.mockResolvedValue({ eventId: 'e1' });

      await sut.create({
        eventId: 'e1',
        code: 'abc',
        ts: '2026-06-16T00:00:00.000Z',
        ip: '1.1.1.1',
        ua: 'ua/1',
      });

      const callArg = model.create.mock.calls[0][0];
      expect(callArg.ts).toBeInstanceOf(Date);
      expect(callArg.ts.toISOString()).toBe('2026-06-16T00:00:00.000Z');
    });

    it('forwards the rest of the payload unchanged', async () => {
      const { sut, model } = makeClickRepository();
      model.create.mockResolvedValue({ eventId: 'e1' });

      await sut.create({
        eventId: 'e1',
        code: 'abc',
        ts: '2026-06-16T00:00:00.000Z',
        ip: '1.1.1.1',
        ua: 'ua/1',
      });

      const callArg = model.create.mock.calls[0][0];
      expect(callArg).toMatchObject({
        eventId: 'e1',
        code: 'abc',
        ip: '1.1.1.1',
        ua: 'ua/1',
      });
    });
  });

  describe('aggregateStats', () => {
    it('returns the rows produced by the aggregation', async () => {
      const { sut, model } = makeClickRepository();
      const rows = [{ _id: 'abc', totalClicks: 5, lastClick: new Date('2026-06-16T00:00:00.000Z') }];
      model.exec.mockResolvedValue(rows);

      const result = await sut.aggregateStats('abc');

      expect(result).toBe(rows);
    });
  });
});
