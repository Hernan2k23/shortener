import { CodeGeneratorService } from '../services/code-generator.service';

const makePool = (poolSize: number, refillThreshold: number) => {
  const codes: string[] = [];
  const out = new Set<string>();
  return {
    poolSize,
    size: jest.fn(() => codes.length),
    isBelowRefillThreshold: jest.fn(() => codes.length < poolSize * refillThreshold),
    take: jest.fn(() => {
      const c = codes.pop();
      if (c === undefined) return undefined;
      out.add(c);
      return c;
    }),
    release: jest.fn((c: string) => {
      if (!out.delete(c)) return;
      codes.push(c);
    }),
    pushMany: jest.fn((batch: readonly string[]) => {
      for (const c of batch) codes.push(c);
    }),
  };
};

const makeEncoder = () => ({ encodeOffset: jest.fn((n: number) => `ENC${n}`) });

const makeCodeGeneratorService = (opts: { poolSize?: number; refillThreshold?: number } = {}) => {
  const poolSize = opts.poolSize ?? 10;
  const refillThreshold = opts.refillThreshold ?? 0.2;
  const allocator = { claimRange: jest.fn() };
  const pool = makePool(poolSize, refillThreshold);
  const shuffler = { shuffle: jest.fn(<T>(arr: readonly T[]) => [...arr]) };
  const encoder = makeEncoder();
  const fallbackEncoder = makeEncoder();

  const sut = new CodeGeneratorService(
    allocator as never,
    pool as never,
    shuffler as never,
    encoder as never,
    fallbackEncoder as never,
  );
  return { sut, allocator, pool, shuffler, encoder, fallbackEncoder };
};

const flushMicrotasks = (): Promise<void> =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe('CodeGeneratorService', () => {
  describe('onModuleInit', () => {
    it('triggers an initial refill with the configured pool size', async () => {
      const { sut, allocator } = makeCodeGeneratorService({ poolSize: 10 });
      allocator.claimRange.mockResolvedValue({ start: 0, size: 10 });

      await sut.onModuleInit();

      expect(allocator.claimRange).toHaveBeenCalledWith(10);
    });
  });

  describe('take', () => {
    it('with codes in the pool, returns a code from the pool', () => {
      const { sut, pool } = makeCodeGeneratorService();
      pool.pushMany(['CODE01', 'CODE02']);

      const code = sut.take();

      expect(code).toBe('CODE02');
    });

    it('with codes in the pool, does not call the fallback encoder', () => {
      const { sut, pool, fallbackEncoder } = makeCodeGeneratorService();
      pool.pushMany(['CODE01', 'CODE02']);

      sut.take();

      expect(fallbackEncoder.encodeOffset).not.toHaveBeenCalled();
    });

    it('with an empty pool, returns a code from the fallback encoder', () => {
      const { sut, pool, fallbackEncoder } = makeCodeGeneratorService();
      pool.take.mockReturnValue(undefined);
      fallbackEncoder.encodeOffset.mockReturnValue('FB00001');

      const code = sut.take();

      expect(code).toBe('FB00001');
    });

    it('when the pool is below the refill threshold, triggers a background refill', async () => {
      const { sut, pool, allocator } = makeCodeGeneratorService();
      pool.isBelowRefillThreshold.mockReturnValue(true);
      pool.take.mockReturnValue('CODE01');
      allocator.claimRange.mockResolvedValue({ start: 0, size: 10 });

      sut.take();

      await flushMicrotasks();

      expect(allocator.claimRange).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('hands the code back to the pool', () => {
      const { sut, pool } = makeCodeGeneratorService();

      sut.release('CODE01');

      expect(pool.release).toHaveBeenCalledWith('CODE01');
    });
  });

  describe('getMetrics', () => {
    it('returns poolDepth from the pool', () => {
      const { sut, pool } = makeCodeGeneratorService();
      pool.size.mockReturnValue(7);

      const metrics = sut.getMetrics();

      expect(metrics.poolDepth).toBe(7);
    });

    it('returns poolSize from the pool', () => {
      const { sut, pool } = makeCodeGeneratorService({ poolSize: 42 });
      pool.size.mockReturnValue(0);

      const metrics = sut.getMetrics();

      expect(metrics.poolSize).toBe(42);
    });

    it('increments fallbackCount when a fallback code is taken', () => {
      const { sut, pool, fallbackEncoder } = makeCodeGeneratorService();
      pool.take.mockReturnValue(undefined);
      fallbackEncoder.encodeOffset.mockReturnValue('FB');

      sut.take();

      expect(sut.getMetrics().fallbackCount).toBe(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('completes cleanly when no refill is in flight', async () => {
      const { sut } = makeCodeGeneratorService();

      await expect(sut.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
