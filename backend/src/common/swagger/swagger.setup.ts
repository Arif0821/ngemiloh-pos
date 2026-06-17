import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Ngemiloh POS API')
    .setDescription(
      `
## POS Nabil - Point of Sale API

### Authentication
All protected endpoints require JWT authentication.
Include the access token in the Authorization header:
\`Authorization: Bearer <token>\`

### Error Responses
All errors follow a consistent format:
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/orders"
}
\`\`\`

### Rate Limiting
- General: 100 requests/minute
- Auth endpoints: 5 requests/10 minutes
    `,
    )
    .setVersion('1.0.0')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Products', 'Product management')
    .addTag('Orders', 'Order processing')
    .addTag('Cash', 'Shift management')
    .addTag('Admin', 'Administrative functions')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT Access Token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Ngemiloh POS API Docs',
    customfavIcon: 'https://picsum.photos/32/32',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2em }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });
}
