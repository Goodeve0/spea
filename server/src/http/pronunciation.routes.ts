import { Router, type Request } from 'express';
import express from 'express';

import { asyncHandler, HttpError } from './errors';
import {
  createPronunciationService,
  type IPronunciationService,
} from '../modules/pronunciation.service';

/** PCM 请求体大小上限（5MB），足够容纳约 2.5 分钟的 16kHz 16bit 单声道音频 */
const PCM_BODY_LIMIT = '5mb';

/**
 * 发音评测路由工厂。
 *
 * POST /pronunciation/assess
 *   - body: application/octet-stream，16kHz/16bit/单声道 raw PCM
 *   - query: referenceText（必填，ASR 识别文本）、turnId（可选，回填关联）
 *   - resp: PronunciationResult（JSON）
 *
 * 设计要点（见 openspec/changes/add-pronunciation-assessment/design.md D3/D6）：
 *  - 用 express.raw 单独解析二进制 body，避免全局 json 中间件干扰
 *  - 服务层（讯飞 ISE）内部失败会降级为 estimate，路由层仅兜未预期异常
 *  - 默认不鉴权（不涉及用户数据隔离），靠 body 上限防滥用
 */
export function createPronunciationRouter(
  service: IPronunciationService = createPronunciationService(),
): Router {
  const router = Router();

  router.post(
    '/pronunciation/assess',
    express.raw({ type: 'application/octet-stream', limit: PCM_BODY_LIMIT }),
    asyncHandler(async (req: Request, res) => {
      const referenceText = String(req.query.referenceText ?? '').trim();
      const turnId = String(req.query.turnId ?? '');

      if (!referenceText) {
        throw new HttpError(400, 'BAD_REQUEST', 'referenceText is required');
      }

      const body = req.body as Buffer | undefined;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'PCM body is empty');
      }

      // Buffer → 独立 ArrayBuffer（复制，确保类型为 ArrayBuffer 而非 ArrayBufferLike）
      const arrayBuffer = new ArrayBuffer(body.byteLength);
      new Uint8Array(arrayBuffer).set(body);

      const result = await service.assess(arrayBuffer, referenceText);
      res.json({ ...result, turnId });
    }),
  );

  return router;
}
