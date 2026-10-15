import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { execSync } from 'child_process';
import path from 'path';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Self-healing: verify database schema exists
    try {
      await prisma.user.count();
    } catch (checkErr: any) {
      if (
        checkErr?.code === 'P2021' ||
        checkErr?.message?.includes('does not exist') ||
        checkErr?.message?.includes('no such table')
      ) {
        console.log('⚠️ Database tables missing. Running automatic schema migration...');
        const backendDir = path.resolve(__dirname, '../..');
        execSync('npx prisma db push --accept-data-loss', {
          cwd: backendDir,
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
        });
        console.log('✅ Schema pushed successfully. Initializing default seeds...');
        try {
          execSync('npx tsx prisma/seed.ts', {
            cwd: backendDir,
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
          });
          console.log('✅ Default seed data populated.');
        } catch (seedErr) {
          console.warn('Seed notice:', seedErr);
        }
      }
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
