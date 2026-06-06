/**
 * 种子瓜友：写入若干 isSeed 用户（拟真练习记录），解决冷启动空窗 + 支撑 Demo。
 * 种子用户不可登录（passwordHash 为哨兵值，bcrypt 永不匹配）。
 * 运行：npm run seed:buddies -w server
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import type { RadarScores } from '@speak-coach/shared';

const prisma = new PrismaClient();
const DAY = 86400000;

interface SeedDef {
  email: string;
  name: string;
  cefr: string;
  slot: string;
  avatar: string;
  targets: string[];
  /** 最近 N 天每天一次练习 */
  recentDays: number;
}

const SEEDS: SeedDef[] = [
  { email: 'seed1@seed.melon', name: '瓜瓜', cefr: 'B1', slot: 'evening', avatar: 'melon', targets: ['interview', 'meeting'], recentDays: 5 },
  { email: 'seed2@seed.melon', name: '小蜜瓜', cefr: 'B2', slot: 'night', avatar: 'sun', targets: ['ielts', 'presentation'], recentDays: 7 },
  { email: 'seed3@seed.melon', name: '青藤', cefr: 'A2', slot: 'morning', avatar: 'sprout', targets: ['restaurant', 'shopping'], recentDays: 3 },
  { email: 'seed4@seed.melon', name: '月牙瓜', cefr: 'B1', slot: 'night', avatar: 'moon', targets: ['smalltalk', 'doctor'], recentDays: 4 },
  { email: 'seed5@seed.melon', name: '彩虹瓜', cefr: 'B2', slot: 'noon', avatar: 'rainbow', targets: ['meeting', 'interview'], recentDays: 6 },
  { email: 'seed6@seed.melon', name: '叶子', cefr: 'A2', slot: 'evening', avatar: 'leaf', targets: ['hotel', 'restaurant'], recentDays: 2 },
  { email: 'seed7@seed.melon', name: '花瓜', cefr: 'B1', slot: 'morning', avatar: 'flower', targets: ['shopping', 'smalltalk'], recentDays: 5 },
  { email: 'seed8@seed.melon', name: '星瓜', cefr: 'C1', slot: 'any', avatar: 'star', targets: ['ielts', 'presentation'], recentDays: 7 },
];

const CEFR_BASE: Record<string, number> = { A2: 55, B1: 68, B2: 80, C1: 90 };

function jitterRadar(base: number): RadarScores {
  const j = () => Math.min(100, Math.max(40, base + Math.round((Math.random() - 0.5) * 20)));
  return { pronunciation: j(), fluency: j(), grammar: j(), vocabulary: j(), taskCompletion: j() };
}

function avg(r: RadarScores): number {
  return Math.round(
    (r.pronunciation + r.fluency + r.grammar + r.vocabulary + r.taskCompletion) / 5,
  );
}

async function main() {
  let count = 0;
  for (const s of SEEDS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        isSeed: true,
        avatarKey: s.avatar,
        nativeLang: 'zh',
        practiceSlot: s.slot,
        targetScenarios: JSON.stringify(s.targets),
      },
      create: {
        email: s.email,
        passwordHash: 'SEED_NO_LOGIN',
        displayName: s.name,
        isSeed: true,
        avatarKey: s.avatar,
        nativeLang: 'zh',
        practiceSlot: s.slot,
        targetScenarios: JSON.stringify(s.targets),
      },
    });

    // 幂等：清掉旧的种子会话再重建
    await prisma.session.deleteMany({ where: { userId: user.id } });

    const base = CEFR_BASE[s.cefr] ?? 65;
    for (let d = 0; d < s.recentDays; d++) {
      const ts = Date.now() - d * DAY;
      const radar = jitterRadar(base);
      await prisma.session.create({
        data: {
          id: `seed-${user.id}-${d}`,
          userId: user.id,
          scenarioId: s.targets[d % s.targets.length],
          difficulty: 'intermediate',
          overallScore: avg(radar),
          cefrEstimate: s.cefr,
          hasUserSpeech: true,
          timestamp: BigInt(ts),
          radar: JSON.stringify(radar),
        },
      });
    }
    count += 1;
  }
  console.log(`✅ Seeded ${count} melon buddies (isSeed).`);
}

main()
  .catch((e) => {
    console.error('[seed-buddies] failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
