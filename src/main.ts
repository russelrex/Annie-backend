import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = configService.get<number>('PORT') ?? 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
}
bootstrap();
