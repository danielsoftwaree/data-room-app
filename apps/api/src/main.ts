import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@repo/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DatabaseMigrator } from './config/database/database.migrator';
import { getCorsOrigins, getPort } from './config/env/env';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter';
import { buildOpenApiDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: getCorsOrigins() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.get(DatabaseMigrator).run();
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  await app.listen(getPort());
}
void bootstrap();
