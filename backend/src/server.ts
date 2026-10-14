import os from 'os';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { logger } from './config/logger.js';
import { JobScheduler } from './jobs/scheduler.js';

async function bootstrap() {
  await connectDB();

  // Initialize automated background compliance jobs
  JobScheduler.init();

  // Helper to discover all local IPv4 network interfaces
  const getNetworkIps = () => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  };

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    const networkIps = getNetworkIps();
    logger.info(`🚀 IT Asset Management Server running in ${env.NODE_ENV} mode`);
    logger.info(`   ➜ Local:   http://localhost:${env.PORT}`);
    networkIps.forEach((ip) => {
      logger.info(`   ➜ Network: http://${ip}:${env.PORT}`);
    });
    logger.info(`📖 Interactive API Documentation: http://localhost:${env.PORT}/api/docs`);
    logger.info(`🩺 Health check endpoint: http://localhost:${env.PORT}/api/v1/health`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully terminating ITAM server...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected. Process exiting cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
