import type { Request, Response, NextFunction } from 'express';

/** 业务 HTTP 错误，带状态码与可读 code/message */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 包装 async 路由处理器，自动把异常交给错误中间件 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** 统一错误处理中间件 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  console.error('[http] 未处理错误:', err);
  res.status(500).json({ code: 'INTERNAL', message: '服务器内部错误' });
}
