import { Router } from 'express';
import type { Api } from '@speak-coach/shared';

import { asyncHandler } from './errors';
import { registerUser, loginUser } from './auth.service';
import { requireAuth, type AuthedRequest } from './auth.middleware';
import { mergeGuestSessions } from './repo';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = (req.body ?? {}) as Api.RegisterReq;
    res.json(await registerUser(email, password, displayName));
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = (req.body ?? {}) as Api.LoginReq;
    res.json(await loginUser(email, password));
  }),
);

// 游客数据合并（需登录）
authRouter.post(
  '/merge',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { sessions } = (req.body ?? {}) as Api.MergeGuestReq;
    const merged = await mergeGuestSessions(req.userId!, sessions ?? []);
    res.json({ merged });
  }),
);
