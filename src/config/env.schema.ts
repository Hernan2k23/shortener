import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  MONGO_USERNAME: Joi.string().optional(),
  MONGO_PASSWORD: Joi.string().optional().allow(''),
  MONGO_URL: Joi.string()
    .uri()
    .default(
      'mongodb://shortener:shortener@localhost:27017/shortener?authSource=admin',
    ),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_USERNAME: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  CACHE_TTL_SECONDS: Joi.number().min(1).default(3600),
  NEGATIVE_CACHE_TTL_SECONDS: Joi.number().min(1).default(30),
  SHORT_BASE_URL: Joi.string().uri().optional(),

  CODE_POOL_SIZE: Joi.number().min(1).default(10_000),
  CODE_POOL_REFILL_THRESHOLD: Joi.number().min(0).max(1).default(0.2),
});
