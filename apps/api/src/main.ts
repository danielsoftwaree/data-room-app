import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@repo/config';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  await app.listen(3000);
}
void bootstrap();
