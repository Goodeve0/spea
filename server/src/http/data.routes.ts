import { Router } from 'express';
import type { Api } from '@speak-coach/shared';

import { asyncHandler } from './errors';
import { requireAuth, type AuthedRequest } from './auth.middleware';
import { getUserById } from './auth.service';
import { submitSession, listSessions, computeGrowth } from './repo';

export const dataRouter = Router();

// 本路由下所有接口都需要鉴权（数据按 userId 隔离）
dataRouter.use(requireAuth);

dataRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getUserById(req.userId!));
  }),
);

dataRouter.post(
  '/sessions',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { session, report } = (req.body ?? {}) as Api.SubmitSessionReq;
    await submitSession(req.userId!, session, report);
    res.json({ ok: true });
  }),
);

dataRouter.get(
  '/sessions',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await listSessions(req.userId!));
  }),
);

dataRouter.get(
  '/growth',
  asyncHandler(async (req: AuthedRequest, res) => {
    const growth: Api.GrowthResp = await computeGrowth(req.userId!);
    res.json(growth);
  }),
);
