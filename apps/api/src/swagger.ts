import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Single source for the OpenAPI document (used by dev server UI and the emit script). */
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Data Room API')
    .setDescription('API contract for the Data Room application')
    .setVersion('0.1.0')
    .build();
  return SwaggerModule.createDocument(app, config, {
    // clean operationIds ("listDatarooms" instead of "DataroomsController_listDatarooms")
    // -> clean generated hook names (useListDatarooms)
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
}
