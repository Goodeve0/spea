/**
 * 种子瓜友：写入若干 isSeed 用户（拟真练习记录），解决冷启动空窗 + 支撑 Demo。
 * 种子用户不可登录（passwordHash 为哨兵值，bcrypt 永不匹配）。
 *
 * 运行：npm run seed:buddies -w server
 *
 * 设计：
 *  - 每个种子用户都有若干历史 session（含 cefrEstimate），
 *    这样 findMatches() 能够按 CEFR ±1 匹配到它们。
 *  - 种子用户两两之间建立 Buddy 关系，使"我的瓜友"示例有内容。
 *    （登录用户只需发起邀请，即可脱离冷启动）
 *  - 幂等：user upsert；旧 session 先删再建；buddy upsert。
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// 支持 ESM（tsx --esm）与 CJS（tsx）两种运行方式
const __dirname_compat =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname_compat, '../../.env') });

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
  { email: 'seed1@seed.melon', name: '瓜瓜',   cefr: 'B1', slot: 'evening', avatar: 'melon',   targets: ['interview', 'meeting'],      recentDays: 5 },
  { email: 'seed2@seed.melon', name: '小蜜瓜', cefr: 'B2', slot: 'night',   avatar: 'sun',      targets: ['ielts', 'presentation'],     recentDays: 7 },
  { email: 'seed3@seed.melon', name: '青藤',   cefr: 'A2', slot: 'morning', avatar: 'sprout',   targets: ['restaurant', 'shopping'],    recentDays: 3 },
  { email: 'seed4@seed.melon', name: '月牙瓜', cefr: 'B1', slot: 'night',   avatar: 'moon',     targets: ['smalltalk', 'doctor'],       recentDays: 4 },
  { email: 'seed5@seed.melon', name: '彩虹瓜', cefr: 'B2', slot: 'noon',    avatar: 'rainbow',  targets: ['meeting', 'interview'],      recentDays: 6 },
  { email: 'seed6@seed.melon', name: '叶子',   cefr: 'A2', slot: 'evening', avatar: 'leaf',     targets: ['hotel', 'restaurant'],       recentDays: 2 },
  { email: 'seed7@seed.melon', name: '花瓜',   cefr: 'B1', slot: 'morning', avatar: 'flower',   targets: ['shopping', 'smalltalk'],     recentDays: 5 },
  { email: 'seed8@seed.melon', name: '星瓜',   cefr: 'C1', slot: 'any',     avatar: 'star',     targets: ['ielts', 'presentation'],     recentDays: 7 },
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

/** 规范化一对用户 id：始终 userAId < userBId，确保唯一性 */
function canonical(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

async function main() {
  // ── 1. 创建/更新种子用户及其 session ──────────────────────────────────────
  const userIds: string[] = [];

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
    userIds.push(user.id);

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
  }

  // ── 2. 种子用户两两建立 Buddy 关系（幂等 upsert）──────────────────────────
  // 只在相邻 CEFR 等级之间建立关系，贴近真实匹配逻辑
  // SEEDS 顺序：B1, B2, A2, B1, B2, A2, B1, C1
  // 将所有对子 upsert，重复无害
  let buddyCount = 0;
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const seedI = SEEDS[i];
      const seedJ = SEEDS[j];
      // 简单规则：CEFR 相差 ≤ 1 级才建关系（避免 A2-C1 这种跨级）
      const LEVELS: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
      const li = LEVELS[seedI.cefr] ?? 2;
      const lj = LEVELS[seedJ.cefr] ?? 2;
      if (Math.abs(li - lj) > 1) continue;

      const { userAId, userBId } = canonical(userIds[i], userIds[j]);
      await prisma.buddy.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: { lastInteractAt: new Date() },
        create: { userAId, userBId },
      });
      buddyCount++;
    }
  }

  console.log(`✅ Seeded ${userIds.length} melon buddies (isSeed), ${buddyCount} buddy pairs.`);
}

main()
  .catch((e) => {
    console.error('[seed-buddies] failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
