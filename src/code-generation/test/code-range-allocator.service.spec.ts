import { CodeRangeAllocatorService } from '../services/code-range-allocator.service';

const makeRedis = () => ({ incrby: jest.fn() });
const makeCodeRangeAllocator = () => {
  const redis = makeRedis();
  const sut = new CodeRangeAllocatorService(redis as never);
  return { sut, redis };
};

describe('CodeRangeAllocatorService', () => {
  describe('claimRange', () => {
    it('with size N, asks Redis to INCRBY N and returns start=total-N, size=N', async () => {
      const { sut, redis } = makeCodeRangeAllocator();
      redis.incrby.mockResolvedValue(1000);

      const r = await sut.claimRange(1000);

      expect(r).toEqual({ start: 0, size: 1000 });
    });

    it('with size N, calls INCRBY against the shortener counter key', async () => {
      const { sut, redis } = makeCodeRangeAllocator();
      redis.incrby.mockResolvedValue(1000);

      await sut.claimRange(1000);

      expect(redis.incrby).toHaveBeenCalledWith('shortener:code_offset', 1000);
    });

    it('on the second call, returns the next disjoint range', async () => {
      const { sut, redis } = makeCodeRangeAllocator();
      redis.incrby.mockResolvedValueOnce(500).mockResolvedValueOnce(1500);

      const r1 = await sut.claimRange(500);
      const r2 = await sut.claimRange(1000);

      expect(r2).toEqual({ start: 500, size: 1000 });
    });
  });
});
