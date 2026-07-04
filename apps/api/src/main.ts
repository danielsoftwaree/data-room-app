import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@repo/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvService } from './config/env';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter';
import { buildOpenApiDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: env.get('CORS_ORIGIN') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  await app.listen(env.get('PORT'));
}
void bootstrap();
