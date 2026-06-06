import { Router } from 'express';
import type { Api, RoomInviteDTO } from '@speak-coach/shared';

import { asyncHandler, HttpError } from './errors';
import { requireAuth, type AuthedRequest } from './auth.middleware';
import * as buddy from './buddy.repo';
import { addRoomInvite, takeRoomInvites } from './room-invite.store';

export const buddyRouter = Router();

// 全部接口需鉴权
buddyRouter.use(requireAuth);

// 同步可公开 profile
buddyRouter.put(
  '/me/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    await buddy.updateProfile(req.userId!, (req.body ?? {}) as Api.UpdateProfileReq);
    res.json({ ok: true });
  }),
);

// 匹配候选
buddyRouter.get(
  '/buddy/matches',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { scenario, slot, lang } = req.query as Record<string, string | undefined>;
    const candidates = await buddy.findMatches(req.userId!, { scenario, slot, lang });
    const resp: Api.MatchesResp = { candidates };
    res.json(resp);
  }),
);

// 发起邀请
buddyRouter.post(
  '/buddy/requests',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { toUserId } = (req.body ?? {}) as Api.SendRequestReq;
    if (!toUserId) throw new HttpError(400, 'INVALID', '缺少 toUserId');
    await buddy.sendRequest(req.userId!, toUserId);
    res.json({ ok: true });
  }),
);

// 我收到的邀请
buddyRouter.get(
  '/buddy/requests',
  asyncHandler(async (req: AuthedRequest, res) => {
    const resp: Api.RequestsResp = { requests: await buddy.listRequests(req.userId!) };
    res.json(resp);
  }),
);

// 接受 / 拒绝邀请
buddyRouter.post(
  '/buddy/requests/:id/accept',
  asyncHandler(async (req: AuthedRequest, res) => {
    await buddy.acceptRequest(req.userId!, String(req.params.id));
    res.json({ ok: true });
  }),
);
buddyRouter.post(
  '/buddy/requests/:id/decline',
  asyncHandler(async (req: AuthedRequest, res) => {
    await buddy.declineRequest(req.userId!, String(req.params.id));
    res.json({ ok: true });
  }),
);

// 瓜友列表
buddyRouter.get(
  '/buddy/list',
  asyncHandler(async (req: AuthedRequest, res) => {
    const resp: Api.BuddyListResp = { buddies: await buddy.listBuddies(req.userId!) };
    res.json(resp);
  }),
);

// 解除瓜友
buddyRouter.delete(
  '/buddy/:buddyId',
  asyncHandler(async (req: AuthedRequest, res) => {
    await buddy.removeBuddy(req.userId!, String(req.params.buddyId));
    res.json({ ok: true });
  }),
);

// 发送 / 接收贴纸
buddyRouter.post(
  '/buddy/encouragements',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { toUserId, stickerKey } = (req.body ?? {}) as Api.SendEncouragementReq;
    if (!toUserId || !stickerKey) throw new HttpError(400, 'INVALID', '参数缺失');
    await buddy.sendEncouragement(req.userId!, toUserId, stickerKey);
    res.json({ ok: true });
  }),
);
buddyRouter.get(
  '/buddy/encouragements',
  asyncHandler(async (req: AuthedRequest, res) => {
    const resp: Api.EncouragementsResp = { encouragements: await buddy.listEncouragements(req.userId!) };
    res.json(resp);
  }),
);

// 排行
buddyRouter.get(
  '/buddy/ranking',
  asyncHandler(async (req: AuthedRequest, res) => {
    const resp: Api.RankingResp = { ranking: await buddy.getRanking(req.userId!) };
    res.json(resp);
  }),
);

// 房间邀请（轮询送达）
buddyRouter.post(
  '/buddy/room-invite',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { toUserId, roomId } = (req.body ?? {}) as Api.RoomInviteReq;
    if (!toUserId || !roomId) throw new HttpError(400, 'INVALID', '参数缺失');
    if (!(await buddy.areBuddies(req.userId!, toUserId))) {
      throw new HttpError(403, 'NOT_BUDDY', '只能邀请瓜友入房');
    }
    addRoomInvite(toUserId, req.userId!, roomId);
    res.json({ ok: true });
  }),
);
buddyRouter.get(
  '/buddy/room-invite',
  asyncHandler(async (req: AuthedRequest, res) => {
    const raw = takeRoomInvites(req.userId!);
    const invites: RoomInviteDTO[] = [];
    for (const inv of raw) {
      invites.push({
        roomId: inv.roomId,
        from: await buddy.buildBuddyCard(inv.fromUserId),
        createdAt: inv.createdAt,
      });
    }
    const resp: Api.RoomInviteResp = { invites };
    res.json(resp);
  }),
);
