import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const indexPath = join(__dirname, '..', 'index.html');
  app.use((req: { method: string; path: string }, res: { sendFile: (p: string) => void }, next: () => void) => {
    if (req.method === 'GET' && req.path === '/') {
      return res.sendFile(indexPath);
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`shortener listening on :${port}`);
}
bootstrap().catch((e) => {
  console.error('shortener bootstrap failed:', e);
  process.exit(1);
});
