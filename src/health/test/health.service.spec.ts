import { HealthService } from '../services/health.service';

const makeMongo = (readyState: number) => ({ readyState });
const makeRedis = () => ({ ping: jest.fn() });
const makeCodeGen = () => {
  const metrics = {
    poolDepth: 5,
    poolSize: 10,
    fallbackCount: 0,
    refillSuccessCount: 1,
    refillFailureCount: 0,
  };
  return { getMetrics: jest.fn().mockReturnValue(metrics) };
};

const makeHealthService = (opts: { mongoReadyState: number; redisOk: boolean } = { mongoReadyState: 1, redisOk: true }) => {
  const redis = makeRedis();
  redis.ping.mockResolvedValue(opts.redisOk);
  const codeGen = makeCodeGen();
  const sut = new HealthService(makeMongo(opts.mongoReadyState) as never, redis as never, codeGen as never);
  return { sut, redis, codeGen, codePoolMetrics: codeGen.getMetrics() };
};

describe('HealthService', () => {
  describe('live', () => {
    it('returns { status: "ok" }', () => {
      const { sut } = makeHealthService();
      expect(sut.live()).toEqual({ status: 'ok' });
    });
  });

  describe('ready', () => {
    it('with mongo connected and redis reachable, returns status=ok', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 1, redisOk: true });

      const result = await sut.ready();

      expect(result.status).toBe('ok');
    });

    it('with mongo connected and redis reachable, reports mongo=true', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 1, redisOk: true });

      const result = await sut.ready();

      expect(result.mongo).toBe(true);
    });

    it('with mongo connected and redis reachable, reports redis=true', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 1, redisOk: true });

      const result = await sut.ready();

      expect(result.redis).toBe(true);
    });

    it('includes the code pool metrics in the readiness payload', async () => {
      const { sut, codePoolMetrics } = makeHealthService({ mongoReadyState: 1, redisOk: true });

      const result = await sut.ready();

      expect(result.codePool).toEqual(codePoolMetrics);
    });

    it('with mongo disconnected, returns status=degraded', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 0, redisOk: true });

      const result = await sut.ready();

      expect(result.status).toBe('degraded');
    });

    it('with mongo disconnected, reports mongo=false', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 0, redisOk: true });

      const result = await sut.ready();

      expect(result.mongo).toBe(false);
    });

    it('with redis unreachable, returns status=degraded', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 1, redisOk: false });

      const result = await sut.ready();

      expect(result.status).toBe('degraded');
    });

    it('with redis unreachable, reports redis=false', async () => {
      const { sut } = makeHealthService({ mongoReadyState: 1, redisOk: false });

      const result = await sut.ready();

      expect(result.redis).toBe(false);
    });
  });
});
