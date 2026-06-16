import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';

const makeHost = (): { host: ArgumentsHost; res: { status: jest.Mock; json: jest.Mock } } => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res as unknown as Response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
};

const makeAllExceptionsFilter = () => ({ sut: new AllExceptionsFilter() });

describe('AllExceptionsFilter', () => {
  describe('catch', () => {
    it('with an HttpException carrying an object body, responds with status=404 and a stable body shape', () => {
      const { sut } = makeAllExceptionsFilter();
      const { host, res } = makeHost();
      const ex = new NotFoundException({ message: 'no code', code: 'URL_NOT_FOUND' });

      sut.catch(ex, host);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'no code',
        code: 'NOT_FOUND',
      });
    });

    it('with a string-body HttpException, uses the string as the message', () => {
      const { sut } = makeAllExceptionsFilter();
      const { host, res } = makeHost();
      const ex = new BadRequestException('bad');

      sut.catch(ex, host);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'bad',
        code: 'BAD_REQUEST',
      });
    });

    it('with a Mongoose duplicate-key error, responds with status=409 and code=DUPLICATE_KEY', () => {
      const { sut } = makeAllExceptionsFilter();
      const { host, res } = makeHost();
      const ex: Error & { code: number } = Object.assign(new Error('dup'), { code: 11000 });

      sut.catch(ex, host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 409,
        error: 'CONFLICT',
        message: 'duplicate key',
        code: 'DUPLICATE_KEY',
      });
    });

    it('with an unknown error, responds with status=500', () => {
      const { sut } = makeAllExceptionsFilter();
      const { host, res } = makeHost();

      sut.catch(new Error('boom'), host);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('with an unknown error, returns the INTERNAL_ERROR body shape', () => {
      const { sut } = makeAllExceptionsFilter();
      const { host, res } = makeHost();

      sut.catch(new Error('boom'), host);

      expect(res.json).toHaveBeenCalledWith({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });
});
