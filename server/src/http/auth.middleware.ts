import type { Request, Response, NextFunction } from 'express';

import { verifyToken } from './auth.service';
import { HttpError } from './errors';

/** 带已鉴权用户 id 的请求 */
export interface AuthedRequest extends Request {
  userId?: string;
}

/** 鉴权中间件：校验 Bearer token，把 userId 注入请求（等价于 Nest Guard） */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', '缺少鉴权信息，请先登录');
  }
  req.userId = verifyToken(header.slice(7));
  next();
}
