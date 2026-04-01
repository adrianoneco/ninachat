import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import fs from 'fs';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  // Enable validation for incoming requests
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Setup Swagger at /api-docs
  try {
    const config = new DocumentBuilder()
      .setTitle('Nina Chat API')
      .setDescription('APIs de integração WPP e ambiente de testes')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  } catch (e) {
    // Log full error to help debugging if Swagger fails to initialize
    console.error('Swagger setup failed:', e && (e.stack || e.message || e));
  }
  app.enableShutdownHooks();

  await app.listen(40001);
  
  // Graceful shutdown handlers for common signals (reloads, docker stop, nodemon)
  const shutdown = async (sig: string) => {
    try {
      // allow Nest to run shutdown hooks
      await app.close();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  };
  
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGHUP', () => shutdown('SIGHUP'));
  
  // For nodemon/bun restart which uses SIGUSR2, close app then re-emit the signal
  process.once('SIGUSR2', async () => {
    try {
      await app.close().catch(() => {});
    } finally {
      process.kill(process.pid, 'SIGUSR2');
    }
  });
}
bootstrap();
