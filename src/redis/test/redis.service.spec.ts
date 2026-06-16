import { ConfigService } from '@nestjs/config';
import { NEGATIVE_SENTINEL, RedisService } from '../services/redis.service';

const makeConfig = (overrides: Record<string, unknown> = {}): ConfigService =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key in overrides) return overrides[key];
      return fallback;
    }),
  }) as unknown as ConfigService;

const makeClient = () => ({ mget: jest.fn(), set: jest.fn(), ping: jest.fn() });
const makeRedisService = (overrides: Record<string, unknown> = {}) => {
  const client = makeClient();
  const sut = new RedisService(client as never, makeConfig(overrides));
  return { sut, client };
};

describe('RedisService', () => {
  describe('getCode', () => {
    it('with a positive hit, returns the URL', async () => {
      const { sut, client } = makeRedisService();
      client.mget.mockResolvedValue(['https://example.com', null]);

      const r = await sut.getCode('abc');

      expect(r).toBe('https://example.com');
    });

    it('with a negative hit, returns the NEGATIVE_SENTINEL', async () => {
      const { sut, client } = makeRedisService();
      client.mget.mockResolvedValue([null, '1']);

      const r = await sut.getCode('abc');

      expect(r).toBe(NEGATIVE_SENTINEL);
    });

    it('with both keys missing, returns null', async () => {
      const { sut, client } = makeRedisService();
      client.mget.mockResolvedValue([null, null]);

      const r = await sut.getCode('abc');

      expect(r).toBeNull();
    });

    it('with both keys populated, returns the positive value (negative is shadowed)', async () => {
      const { sut, client } = makeRedisService();
      client.mget.mockResolvedValue(['https://example.com', '1']);

      const r = await sut.getCode('abc');

      expect(r).toBe('https://example.com');
    });

    it('looks up the positive and negative keys for the given code', async () => {
      const { sut, client } = makeRedisService();
      client.mget.mockResolvedValue([null, null]);

      await sut.getCode('abc');

      expect(client.mget).toHaveBeenCalledWith('url:abc', 'url:none:abc');
    });
  });

  describe('setCode', () => {
    it('writes the URL under url:{code} with the configured TTL plus a 0..(base*0.1)s jitter', async () => {
      const randomSpy = jest.spyOn(Math, 'random');

      randomSpy.mockReturnValue(0);
      const { sut, client } = makeRedisService({ CACHE_TTL_SECONDS: 100 });
      await sut.setCode('abc', 'https://example.com');
      expect(client.set.mock.calls[0][3]).toBe(100);

      randomSpy.mockReturnValue(0.999_999_999_999);
      await sut.setCode('abc', 'https://example.com');
      expect(client.set.mock.calls[1][3]).toBe(109);

      randomSpy.mockRestore();
    });

    it('writes the URL under the url:{code} key', async () => {
      const { sut, client } = makeRedisService();
      client.set.mockResolvedValue('OK');

      await sut.setCode('abc', 'https://example.com');

      expect(client.set).toHaveBeenCalledWith(
        'url:abc',
        'https://example.com',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('setNegative', () => {
    it('writes the negative sentinel under url:none:{code} with the configured negative TTL', async () => {
      const { sut, client } = makeRedisService({ NEGATIVE_CACHE_TTL_SECONDS: 30 });

      await sut.setNegative('abc');

      expect(client.set).toHaveBeenCalledWith('url:none:abc', '1', 'EX', 30);
    });
  });

  describe('ping', () => {
    it('with a PONG reply, returns true', async () => {
      const { sut, client } = makeRedisService();
      client.ping.mockResolvedValue('PONG');

      const r = await sut.ping();

      expect(r).toBe(true);
    });

    it('with a non-PONG reply, returns false', async () => {
      const { sut, client } = makeRedisService();
      client.ping.mockResolvedValue('WAT');

      const r = await sut.ping();

      expect(r).toBe(false);
    });

    it('when the client throws, returns false', async () => {
      const { sut, client } = makeRedisService();
      client.ping.mockRejectedValue(new Error('redis down'));

      const r = await sut.ping();

      expect(r).toBe(false);
    });
  });
});
