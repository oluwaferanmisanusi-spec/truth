import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { validationPipe } from './config/validation.js';

async function bootstrap() {
  // rawBody: the Paystack webhook needs the exact bytes to check its signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(validationPipe);
  // Don't advertise the server software.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.enableShutdownHooks();
  // No CORS: only the website's server calls the API, never a browser directly.
  // Vercel runs the API as a function and says which port to use in PORT; locally it's API_PORT.
  await app.listen(
    process.env.PORT ??
      app.get(ConfigService<Env, true>).get('API_PORT', { infer: true }),
  );
}
await bootstrap();
