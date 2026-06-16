import { UrlRepository } from '../repositories/url.repository';

const makeModel = () => {
  const exec = jest.fn();
  const lean = jest.fn().mockReturnValue({ exec });
  const findOne = jest.fn().mockReturnValue({ lean });
  const create = jest.fn();
  return { create, findOne, lean, exec };
};

const makeUrlRepository = () => {
  const model = makeModel();
  const sut = new UrlRepository(model as never);
  return { sut, model };
};

describe('UrlRepository', () => {
  describe('create', () => {
    it('with a custom alias, forwards code/originalUrl/customAlias to the model', async () => {
      const { sut, model } = makeUrlRepository();
      model.create.mockResolvedValue({ code: 'alias1' });

      await sut.create({ code: 'alias1', originalUrl: 'https://example.com', customAlias: 'alias1' });

      expect(model.create).toHaveBeenCalledWith({
        code: 'alias1',
        originalUrl: 'https://example.com',
        customAlias: 'alias1',
      });
    });

    it('without a customAlias, defaults customAlias to null', async () => {
      const { sut, model } = makeUrlRepository();
      model.create.mockResolvedValue({ code: 'AAAAAAa' });

      await sut.create({ code: 'AAAAAAa', originalUrl: 'https://example.com' });

      expect(model.create).toHaveBeenCalledWith({
        code: 'AAAAAAa',
        originalUrl: 'https://example.com',
        customAlias: null,
      });
    });
  });

  describe('findByCode', () => {
    it('on a hit, returns the lean document', async () => {
      const { sut, model } = makeUrlRepository();
      const doc = { code: 'abc', originalUrl: 'https://example.com' };
      model.exec.mockResolvedValue(doc);

      const result = await sut.findByCode('abc');

      expect(result).toBe(doc);
    });

    it('on a miss, returns null', async () => {
      const { sut, model } = makeUrlRepository();
      model.exec.mockResolvedValue(null);

      const result = await sut.findByCode('missing');

      expect(result).toBeNull();
    });
  });
});
