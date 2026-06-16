import { envValidationSchema } from '../env.schema';

const base = {
  MONGO_URL: 'mongodb://user:pass@localhost:27017/shortener',
  REDIS_HOST: 'localhost',
};

describe('envValidationSchema', () => {
  describe('validity', () => {
    it('accepts the minimum required env', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.MONGO_URL).toBe(base.MONGO_URL);
    });

    it('accepts overrides for every optional key', () => {
      const { error } = envValidationSchema.validate({
        ...base,
        NODE_ENV: 'production',
        PORT: 8080,
        SHORT_BASE_URL: 'https://sho.rt',
        REDIS_PORT: 6380,
        REDIS_PASSWORD: 'secret',
        CACHE_TTL_SECONDS: 120,
        NEGATIVE_CACHE_TTL_SECONDS: 5,
        CODE_POOL_SIZE: 500,
        CODE_POOL_REFILL_THRESHOLD: 0.5,
      });
      expect(error).toBeUndefined();
    });

    it('uses the default MONGO_URL when not provided', () => {
      const { error, value } = envValidationSchema.validate({ ...base, MONGO_URL: undefined });
      expect(error).toBeUndefined();
      expect(value.MONGO_URL).toBe(
        'mongodb://shortener:shortener@localhost:27017/shortener?authSource=admin',
      );
    });

    it('rejects a non-URI MONGO_URL', () => {
      const { error } = envValidationSchema.validate({ ...base, MONGO_URL: 'not a uri' });
      expect(error).toBeDefined();
    });

    it('rejects a missing REDIS_HOST', () => {
      const { error } = envValidationSchema.validate({ ...base, REDIS_HOST: undefined });
      expect(error).toBeDefined();
    });

    it('accepts a missing SHORT_BASE_URL (derived from PORT)', () => {
      const { error } = envValidationSchema.validate({ ...base, SHORT_BASE_URL: undefined });
      expect(error).toBeUndefined();
    });

    it('rejects a non-URI SHORT_BASE_URL when provided', () => {
      const { error } = envValidationSchema.validate({ ...base, SHORT_BASE_URL: 'not a uri' });
      expect(error).toBeDefined();
    });

    it('rejects a CACHE_TTL_SECONDS below 1', () => {
      const { error } = envValidationSchema.validate({ ...base, CACHE_TTL_SECONDS: 0 });
      expect(error).toBeDefined();
    });

    it('rejects a CODE_POOL_REFILL_THRESHOLD above 1', () => {
      const { error } = envValidationSchema.validate({ ...base, CODE_POOL_REFILL_THRESHOLD: 1.5 });
      expect(error).toBeDefined();
    });

    it('rejects a CODE_POOL_REFILL_THRESHOLD below 0', () => {
      const { error } = envValidationSchema.validate({ ...base, CODE_POOL_REFILL_THRESHOLD: -0.1 });
      expect(error).toBeDefined();
    });

    it('rejects an invalid NODE_ENV', () => {
      const { error } = envValidationSchema.validate({ ...base, NODE_ENV: 'staging' });
      expect(error).toBeDefined();
    });
  });

  describe('defaults', () => {
    it('with no NODE_ENV, defaults to "development"', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.NODE_ENV).toBe('development');
    });

    it('with no PORT, defaults to 3000', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.PORT).toBe(3000);
    });

    it('with no REDIS_PORT, defaults to 6379', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.REDIS_PORT).toBe(6379);
    });

    it('with no CACHE_TTL_SECONDS, defaults to 3600', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.CACHE_TTL_SECONDS).toBe(3600);
    });

    it('with no NEGATIVE_CACHE_TTL_SECONDS, defaults to 30', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.NEGATIVE_CACHE_TTL_SECONDS).toBe(30);
    });

    it('with no CODE_POOL_SIZE, defaults to 10000', () => {
      const { error, value } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.CODE_POOL_SIZE).toBe(10_000);
    });

    it('with no CODE_POOL_REFILL_THRESHOLD, validates without error', () => {
      const { error } = envValidationSchema.validate(base);
      expect(error).toBeUndefined();
    });

    it('with no CODE_POOL_REFILL_THRESHOLD, defaults to 0.2', () => {
      const { value } = envValidationSchema.validate(base);
      expect(value.CODE_POOL_REFILL_THRESHOLD).toBe(0.2);
    });

    it('with no MONGO_URL, defaults to the dev stack URI', () => {
      const { error, value } = envValidationSchema.validate({
        REDIS_HOST: 'localhost',
      });
      expect(error).toBeUndefined();
      expect(value.MONGO_URL).toBe(
        'mongodb://shortener:shortener@localhost:27017/shortener?authSource=admin',
      );
    });
  });
});
