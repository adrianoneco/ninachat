import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import fs from 'fs';
import * as bodyParser from 'body-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  // Increase request body size limits to allow larger payloads (file uploads via form-data/binary)
  // Default was 100kb which caused PayloadTooLargeError for ~200-400kb requests.
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
  // Serve uploaded files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });
  // Enable validation for incoming requests
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Setup Swagger at /api-docs
  try {
    const config = new DocumentBuilder()
      .setTitle('LiveChat API')
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

// Suppress unhandled rejections from Puppeteer/WPPConnect context-destroyed errors
// (WhatsApp Web navigates the page during updates, causing transient execution context errors)
const TRANSIENT_PUPPETEER_MSGS = [
  'Execution context was destroyed',
  'detached Frame',
  'Target closed',
  'Session closed',
  'not attached to an active page',
  'Protocol error',
];
process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '');
  if (TRANSIENT_PUPPETEER_MSGS.some(s => msg.includes(s))) {
    // swallow — these are expected during WhatsApp Web navigations
    return;
  }
  console.error('Unhandled Rejection:', reason);
});
