import { Controller, All, NotFoundException } from '@nestjs/common';

@Controller()
export class FallbackController {
  @All('*')
  notFound(): never {
    throw new NotFoundException('route not found');
  }
}
