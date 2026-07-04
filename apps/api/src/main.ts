import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@repo/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
