import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShortenerService } from '../services/shortener.service';
import { NEGATIVE_SENTINEL } from '../../redis/services/redis.service';
import type { RequestMeta } from '../../common/decorators/current-request-meta.decorator';

const makeConfig = (): ConfigService =>
  ({
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'SHORT_BASE_URL') return 'http://localhost:3000';
      if (key === 'PORT') return 3000;
      return undefined;
    }),
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
  }) as unknown as ConfigService;

const makeUrlRepo = () => ({ create: jest.fn(), findByCode: jest.fn() });
const makeCodeGen = () => ({ take: jest.fn(), release: jest.fn() });
const makeCache = () => ({
  getCode: jest.fn(),
  setCode: jest.fn().mockResolvedValue(undefined),
  setNegative: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn(),
});
const makeAnalytics = () => ({ recordClick: jest.fn(), getStats: jest.fn() });

const makeShortenerService = () => {
  const urls = makeUrlRepo();
  const codeGen = makeCodeGen();
  const cache = makeCache();
  const analytics = makeAnalytics();
  const config = makeConfig();
  const sut = new ShortenerService(urls as any, codeGen as any, cache as any, analytics as any, config);
  return { sut, urls, codeGen, cache, analytics, config };
};

const ctx: RequestMeta = { ip: '127.0.0.1', ua: 'ua/1' };

describe('ShortenerService', () => {
  describe('create', () => {
    it('with a custom alias, persists under the alias and returns the short URL', async () => {
      const { sut, urls } = makeShortenerService();
      urls.create.mockResolvedValue({ code: 'my-alias' });

      const result = await sut.create({ originalUrl: 'https://example.com', alias: 'my-alias' });

      expect(result).toEqual({ code: 'my-alias', shortUrl: 'http://localhost:3000/my-alias' });
    });

    it('with a custom alias, forwards code/originalUrl/customAlias to the repository', async () => {
      const { sut, urls } = makeShortenerService();
      urls.create.mockResolvedValue({ code: 'my-alias' });

      await sut.create({ originalUrl: 'https://example.com', alias: 'my-alias' });

      expect(urls.create).toHaveBeenCalledWith({
        code: 'my-alias',
        originalUrl: 'https://example.com',
        customAlias: 'my-alias',
      });
    });

    it('with no alias, takes a code from the pool and returns the short URL', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAa');
      urls.create.mockResolvedValue({ code: 'AAAAAAa' });

      const result = await sut.create({ originalUrl: 'https://example.com' });

      expect(result).toEqual({ code: 'AAAAAAa', shortUrl: 'http://localhost:3000/AAAAAAa' });
    });

    it('with no alias, persists the code with customAlias=null', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAa');
      urls.create.mockResolvedValue({ code: 'AAAAAAa' });

      await sut.create({ originalUrl: 'https://example.com' });

      expect(urls.create).toHaveBeenCalledWith({
        code: 'AAAAAAa',
        originalUrl: 'https://example.com',
        customAlias: null,
      });
    });

    it('on a duplicate-key error, releases the bad code and retries with a fresh one', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValueOnce('collide1').mockReturnValueOnce('fresh1');
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      urls.create.mockRejectedValueOnce(duplicate).mockResolvedValueOnce({ code: 'fresh1' });

      await sut.create({ originalUrl: 'https://example.com' });

      expect(codeGen.release).toHaveBeenCalledWith('collide1');
      expect(codeGen.take).toHaveBeenCalledTimes(2);
    });

    it('on a duplicate-key error, returns the short URL of the retry attempt', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValueOnce('collide1').mockReturnValueOnce('fresh1');
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      urls.create.mockRejectedValueOnce(duplicate).mockResolvedValueOnce({ code: 'fresh1' });

      const result = await sut.create({ originalUrl: 'https://example.com' });

      expect(result).toEqual({ code: 'fresh1', shortUrl: 'http://localhost:3000/fresh1' });
    });

    it('on a duplicate-key error that exhausts retries, rethrows the duplicate', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      urls.create.mockRejectedValue(duplicate);

      await expect(sut.create({ originalUrl: 'https://example.com' })).rejects.toBe(duplicate);
    });

    it('on a duplicate-key error that exhausts retries, takes exactly MAX_RETRIES+1 codes', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      urls.create.mockRejectedValue(duplicate);

      await sut.create({ originalUrl: 'https://example.com' }).catch(() => undefined);

      expect(codeGen.take).toHaveBeenCalledTimes(3);
    });

    it('on a duplicate-key error that exhausts retries, releases every attempted code', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const duplicate: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });
      urls.create.mockRejectedValue(duplicate);

      await sut.create({ originalUrl: 'https://example.com' }).catch(() => undefined);

      expect(codeGen.release).toHaveBeenCalledTimes(3);
      expect(codeGen.release).toHaveBeenCalledWith('AAAAAAA');
    });

    it('on a non-duplicate error, rethrows the original error', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const boom = new Error('mongo down');
      urls.create.mockRejectedValue(boom);

      await expect(sut.create({ originalUrl: 'https://example.com' })).rejects.toBe(boom);
    });

    it('on a non-duplicate error, does not retry', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const boom = new Error('mongo down');
      urls.create.mockRejectedValue(boom);

      await sut.create({ originalUrl: 'https://example.com' }).catch(() => undefined);

      expect(codeGen.take).toHaveBeenCalledTimes(1);
    });

    it('on a non-duplicate error, releases the code', async () => {
      const { sut, urls, codeGen } = makeShortenerService();
      codeGen.take.mockReturnValue('AAAAAAA');
      const boom = new Error('mongo down');
      urls.create.mockRejectedValue(boom);

      await sut.create({ originalUrl: 'https://example.com' }).catch(() => undefined);

      expect(codeGen.release).toHaveBeenCalledWith('AAAAAAA');
    });
  });

  describe('resolveAndTrack', () => {
    it('on a positive cache hit, returns the cached URL', async () => {
      const { sut, cache } = makeShortenerService();
      cache.getCode.mockResolvedValue('https://example.com');

      const url = await sut.resolveAndTrack('abc', ctx);

      expect(url).toBe('https://example.com');
    });

    it('on a positive cache hit, records a click with the request meta', async () => {
      const { sut, cache, analytics } = makeShortenerService();
      cache.getCode.mockResolvedValue('https://example.com');

      await sut.resolveAndTrack('abc', ctx);

      expect(analytics.recordClick).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'abc', ip: '127.0.0.1', ua: 'ua/1' }),
      );
    });

    it('on a negative cache hit, throws NotFoundException', async () => {
      const { sut, cache } = makeShortenerService();
      cache.getCode.mockResolvedValue(NEGATIVE_SENTINEL);

      await expect(sut.resolveAndTrack('abc', ctx)).rejects.toThrow(NotFoundException);
    });

    it('on a negative cache hit, does not record a click', async () => {
      const { sut, cache, analytics } = makeShortenerService();
      cache.getCode.mockResolvedValue(NEGATIVE_SENTINEL);

      await sut.resolveAndTrack('abc', ctx).catch(() => undefined);

      expect(analytics.recordClick).not.toHaveBeenCalled();
    });

    it('on cache miss and Mongo hit, returns the URL from the doc', async () => {
      const { sut, cache, urls } = makeShortenerService();
      cache.getCode.mockResolvedValue(null);
      urls.findByCode.mockResolvedValue({ code: 'abc', originalUrl: 'https://example.com' });

      const url = await sut.resolveAndTrack('abc', ctx);

      expect(url).toBe('https://example.com');
    });

    it('on cache miss and Mongo hit, populates the positive cache', async () => {
      const { sut, cache, urls } = makeShortenerService();
      cache.getCode.mockResolvedValue(null);
      urls.findByCode.mockResolvedValue({ code: 'abc', originalUrl: 'https://example.com' });

      await sut.resolveAndTrack('abc', ctx);

      expect(cache.setCode).toHaveBeenCalledWith('abc', 'https://example.com');
    });

    it('on cache miss and Mongo miss, throws NotFoundException', async () => {
      const { sut, cache, urls } = makeShortenerService();
      cache.getCode.mockResolvedValue(null);
      urls.findByCode.mockResolvedValue(null);

      await expect(sut.resolveAndTrack('missing', ctx)).rejects.toThrow(NotFoundException);
    });

    it('on cache miss and Mongo miss, writes the negative cache', async () => {
      const { sut, cache, urls } = makeShortenerService();
      cache.getCode.mockResolvedValue(null);
      urls.findByCode.mockResolvedValue(null);

      await sut.resolveAndTrack('missing', ctx).catch(() => undefined);

      expect(cache.setNegative).toHaveBeenCalledWith('missing');
    });

    it('on cache miss and Mongo miss, does not record a click', async () => {
      const { sut, cache, urls, analytics } = makeShortenerService();
      cache.getCode.mockResolvedValue(null);
      urls.findByCode.mockResolvedValue(null);

      await sut.resolveAndTrack('missing', ctx).catch(() => undefined);

      expect(analytics.recordClick).not.toHaveBeenCalled();
    });

    it('when recordClick throws synchronously, still returns the URL', async () => {
      const { sut, cache, analytics } = makeShortenerService();
      cache.getCode.mockResolvedValue('https://example.com');
      analytics.recordClick.mockImplementation(() => {
        throw new Error('queue down');
      });

      const url = await sut.resolveAndTrack('abc', ctx);

      expect(url).toBe('https://example.com');
    });
  });
});
