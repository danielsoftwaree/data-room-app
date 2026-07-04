import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@repo/config';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './swagger';

/** Emits openapi.json without starting an HTTP listener. Consumed by @repo/api-client (Orval). */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);
  const document = buildOpenApiDocument(app);
  const target = join(process.cwd(), 'openapi.json');
  writeFileSync(target, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  console.log(`OpenAPI schema written to ${target}`);
}

void main();
