import { NotFoundException } from '@nestjs/common';
import { FallbackController } from '../controllers/fallback.controller';

const makeFallbackController = () => ({ sut: new FallbackController() });

describe('FallbackController', () => {
  describe('notFound', () => {
    it('throws NotFoundException', () => {
      const { sut } = makeFallbackController();
      expect(() => sut.notFound()).toThrow(NotFoundException);
    });
  });
});
