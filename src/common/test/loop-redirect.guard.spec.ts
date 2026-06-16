import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { LoopRedirectGuard } from '../guards/loop-redirect.guard';

const makeCtx = (req: { hostname: string; body?: { originalUrl?: unknown } }): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    getType: () => 'http',
  }) as unknown as ExecutionContext;

const makeLoopRedirectGuard = () => ({ sut: new LoopRedirectGuard() });

describe('LoopRedirectGuard', () => {
  describe('canActivate', () => {
    it('returns true when there is no body', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(sut.canActivate(makeCtx({ hostname: 'short.test' }))).toBe(true);
    });

    it('returns true when body has no originalUrl', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(sut.canActivate(makeCtx({ hostname: 'short.test', body: {} }))).toBe(true);
    });

    it('returns true when originalUrl is not a string', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(
        sut.canActivate(makeCtx({ hostname: 'short.test', body: { originalUrl: 123 } })),
      ).toBe(true);
    });

    it('returns true when originalUrl points at a different host', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(
        sut.canActivate(
          makeCtx({ hostname: 'short.test', body: { originalUrl: 'https://example.com/x' } }),
        ),
      ).toBe(true);
    });

    it('throws BadRequestException when originalUrl points at this shortener', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(() =>
        sut.canActivate(
          makeCtx({ hostname: 'short.test', body: { originalUrl: 'https://short.test/x' } }),
        ),
      ).toThrow(BadRequestException);
    });

    it('delegates URL validation upstream (returns true for malformed originalUrl)', () => {
      const { sut } = makeLoopRedirectGuard();
      expect(
        sut.canActivate(makeCtx({ hostname: 'short.test', body: { originalUrl: 'not a url' } })),
      ).toBe(true);
    });
  });
});
