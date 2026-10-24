import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { validationPipe } from './config/validation.js';

async function bootstrap() {
  // rawBody: the Paystack webhook needs the exact bytes to check its signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(validationPipe);
  app.enableShutdownHooks();
  // No CORS: only the website's server calls the API, never a browser directly.
  await app.listen(
    app.get(ConfigService<Env, true>).get('API_PORT', { infer: true }),
  );
}
await bootstrap();
