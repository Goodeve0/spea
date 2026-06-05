import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthResult, User } from '@speak-coach/shared';

import { prisma } from '../db/prisma';
import { HttpError } from './errors';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DbUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

function sign(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

/** 校验 token，返回 userId；失败抛 401 */
export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!payload.sub) throw new Error('no sub');
    return payload.sub;
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
  }
}

function toPublic(u: DbUser): User {
  return { id: u.id, displayName: u.displayName, email: u.email };
}

/** 注册新用户 */
export async function registerUser(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'INVALID_EMAIL', '邮箱格式不正确');
  if (!password || password.length < 6) {
    throw new HttpError(400, 'WEAK_PASSWORD', '密码至少 6 位');
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'EMAIL_TAKEN', '该邮箱已被注册');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName?.trim() || email.split('@')[0] },
  });
  return { token: sign(user.id), user: toPublic(user) };
}

/** 登录 */
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  // 不区分"用户不存在/密码错误"，避免账号枚举
  if (!user) throw new HttpError(401, 'INVALID_CREDENTIALS', '邮箱或密码错误');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', '邮箱或密码错误');
  return { token: sign(user.id), user: toPublic(user) };
}

/** 取用户公开信息 */
export async function getUserById(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在');
  return toPublic(user);
}
