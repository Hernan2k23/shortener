import { ConfigService } from '@nestjs/config';
import { CodePool } from '../services/code-pool.service';

const makeConfig = (overrides: Record<string, unknown> = {}): ConfigService =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key in overrides) return overrides[key];
      return fallback;
    }),
  }) as unknown as ConfigService;

const makeCodePool = (overrides: Record<string, unknown> = {}) => {
  const sut = new CodePool(makeConfig(overrides));
  return { sut };
};

describe('CodePool', () => {
  describe('size', () => {
    it('with an empty pool, returns 0', () => {
      const { sut } = makeCodePool();
      expect(sut.size()).toBe(0);
    });

    it('after pushMany, returns the pushed count', () => {
      const { sut } = makeCodePool();
      sut.pushMany(['a', 'b', 'c']);
      expect(sut.size()).toBe(3);
    });
  });

  describe('isBelowRefillThreshold', () => {
    it('with an empty pool, is true', () => {
      const { sut } = makeCodePool({ CODE_POOL_SIZE: 10, CODE_POOL_REFILL_THRESHOLD: 0.5 });
      expect(sut.isBelowRefillThreshold()).toBe(true);
    });

    it('above the threshold, is false', () => {
      const { sut } = makeCodePool({ CODE_POOL_SIZE: 10, CODE_POOL_REFILL_THRESHOLD: 0.2 });
      sut.pushMany(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
      expect(sut.isBelowRefillThreshold()).toBe(false);
    });
  });

  describe('take', () => {
    it('with a non-empty pool, pops a code', () => {
      const { sut } = makeCodePool();
      sut.pushMany(['a', 'b']);

      const c = sut.take();

      expect(c).toBe('b');
    });

    it('with an empty pool, returns undefined', () => {
      const { sut } = makeCodePool();

      const c = sut.take();

      expect(c).toBeUndefined();
    });
  });

  describe('release', () => {
    it.each<{
      name: string;
      seed: readonly string[];
      taken: (sut: CodePool) => string | undefined;
      action: (sut: CodePool, taken: string | undefined) => void;
      expectedSize: number;
    }>([
      {
        name: 'after a take, returns the code to the pool',
        seed: ['a'],
        taken: (sut) => sut.take(),
        action: (sut, taken) => sut.release(taken!),
        expectedSize: 1,
      },
      {
        name: 'with a code that was never taken, is a no-op',
        seed: ['a'],
        taken: () => undefined,
        action: (sut) => sut.release('zzzz'),
        expectedSize: 1,
      },
      {
        name: 'with a code that was already released, is a no-op',
        seed: ['a'],
        taken: (sut) => sut.take(),
        action: (sut, taken) => {
          sut.release(taken!);
          sut.release(taken!);
        },
        expectedSize: 1,
      },
    ])('$name', ({ seed, taken, action, expectedSize }) => {
      const { sut } = makeCodePool();
      sut.pushMany(seed);
      const t = taken(sut);

      action(sut, t);

      expect(sut.size()).toBe(expectedSize);
    });
  });

  describe('pushMany', () => {
    it('appends every code in the batch', () => {
      const { sut } = makeCodePool();
      sut.pushMany(['a', 'b', 'c', 'd']);

      expect(sut.size()).toBe(4);
    });
  });

  describe('config defaults', () => {
    it('falls back to poolSize=10000 when config is missing the key', () => {
      const { sut } = makeCodePool();
      expect(sut.poolSize).toBe(10_000);
    });

    it('falls back to threshold=0.2 when config is missing the key', () => {
      const { sut } = makeCodePool();
      expect(sut.isBelowRefillThreshold()).toBe(true);
    });
  });
});
