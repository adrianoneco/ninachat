import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
