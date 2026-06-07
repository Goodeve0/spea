import express, { type Express, type Request, type Response, type NextFunction } from 'express';

import { authRouter } from './auth.routes';
import { dataRouter } from './data.routes';
import { buddyRouter } from './buddy.routes';
import { createPronunciationRouter } from './pronunciation.routes';
import { errorMiddleware } from './errors';

/** 轻量 CORS（dev：放开本地前端访问） */
function cors(req: Request, res: Response, next: NextFunction): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

/** 创建 HTTP API 应用（与 WS 网关并存） */
export function createHttpApp(): Express {
  const app = express();
  app.use(cors);
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  // 发音评测：路由内部用 express.raw 解析 octet-stream PCM。
  // 全局 express.json 仅作用于 application/json，不会干扰二进制 body。
  app.use('/', createPronunciationRouter());
  app.use('/auth', authRouter);
  app.use('/', dataRouter);
  app.use('/', buddyRouter);

  app.use(errorMiddleware);
  return app;
}
