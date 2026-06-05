import { config } from 'dotenv';
import { resolve } from 'path';

// 加载 server 本地 .env（含 DATABASE_URL / JWT_SECRET），运行时与测试都生效
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';

/** Prisma 单例（避免 dev 热重载产生多连接） */
export const prisma = new PrismaClient();
