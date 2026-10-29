import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { validationPipe } from './config/validation.js';

// rawBody: the Paystack webhook needs the exact bytes to check its signature.
const app = await NestFactory.create(AppModule, { rawBody: true });
app.useGlobalPipes(validationPipe);
// Don't advertise the server software.
app.getHttpAdapter().getInstance().disable('x-powered-by');
app.enableShutdownHooks();
// No CORS: only the website's server calls the API, never a browser directly.

// Run directly (npm run dev:api, start:prod), the API listens on API_PORT. On Vercel this file is
// imported instead and the request handler below is used: Vercel holds back app.listen() until
// the import finishes, so listening here would hang every request (found 2026-10-28).
if (import.meta.main) {
  await app.listen(
    app.get(ConfigService<Env, true>).get('API_PORT', { infer: true }),
  );
} else {
  await app.init();
}

export default app.getHttpAdapter().getInstance();
