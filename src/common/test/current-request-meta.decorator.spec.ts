import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CurrentRequestMeta, type RequestMeta } from '../decorators/current-request-meta.decorator';

@Controller('meta-test')
class MetaTestController {
  @Get()
  echo(@CurrentRequestMeta() meta: RequestMeta): { ip: string | null; ua: string | null } {
    return { ip: meta.ip, ua: meta.ua };
  }
}

const makeApp = async (): Promise<INestApplication> => {
  const mod = await Test.createTestingModule({
    controllers: [MetaTestController],
  }).compile();
  return mod.createNestApplication();
};

describe('CurrentRequestMeta', () => {
  describe('ip', () => {
    it('forwards req.ip on the response body', async () => {
      const app = await makeApp();
      await app.init();

      const res = await request(app.getHttpServer()).get('/meta-test');

      expect(res.body.ip).toMatch(/^(::ffff:)?127\.0\.0\.1$/);

      await app.close();
    });
  });

  describe('ua', () => {
    it('forwards the user-agent header on the response body', async () => {
      const app = await makeApp();
      await app.init();

      const res = await request(app.getHttpServer())
        .get('/meta-test')
        .set('user-agent', 'curl/8');

      expect(res.body.ua).toBe('curl/8');

      await app.close();
    });

    it('returns null ua when no user-agent header is sent', async () => {
      const app = await makeApp();
      await app.init();

      const res = await request(app.getHttpServer()).get('/meta-test');

      expect(res.body.ua).toBeNull();

      await app.close();
    });
  });
});
