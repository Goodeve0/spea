import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { buildXfyunIseAuthUrl, buildXfyunTtsAuthUrl, buildXfyunWsAuthUrl } from './xfyun-auth';

describe('xfyun-auth', () => {
  describe('buildXfyunWsAuthUrl', () => {
    it('生成包含 authorization / date / host 三个 query 的 wss URL', () => {
      const url = buildXfyunWsAuthUrl('tts-api.xfyun.cn', '/v2/tts', 'test-key', 'test-secret');
      const parsed = new URL(url);

      expect(parsed.protocol).toBe('wss:');
      expect(parsed.host).toBe('tts-api.xfyun.cn');
      expect(parsed.pathname).toBe('/v2/tts');
      expect(parsed.searchParams.get('host')).toBe('tts-api.xfyun.cn');
      expect(parsed.searchParams.get('authorization')).toBeTruthy();
      expect(parsed.searchParams.get('date')).toBeTruthy();
    });

    it('authorization 字段是合法 base64 且解码后包含 api_key 与 signature', () => {
      const url = buildXfyunWsAuthUrl('tts-api.xfyun.cn', '/v2/tts', 'my-api-key', 'my-secret');
      const auth = new URL(url).searchParams.get('authorization') ?? '';
      const decoded = Buffer.from(auth, 'base64').toString('utf-8');

      expect(decoded).toContain('api_key="my-api-key"');
      expect(decoded).toContain('algorithm="hmac-sha256"');
      expect(decoded).toContain('signature=');
    });
  });

  describe('buildXfyunIseAuthUrl', () => {
    it('指向 ISE 鉴权 endpoint', () => {
      const url = buildXfyunIseAuthUrl('k', 's');
      const parsed = new URL(url);
      expect(parsed.host).toBe('ise-api.xfyun.cn');
      expect(parsed.pathname).toBe('/v2/open-ise');
    });
  });

  describe('buildXfyunTtsAuthUrl', () => {
    const originalKey = process.env.XFYUN_API_KEY;
    const originalSecret = process.env.XFYUN_API_SECRET;

    beforeEach(() => {
      delete process.env.XFYUN_API_KEY;
      delete process.env.XFYUN_API_SECRET;
    });

    afterEach(() => {
      if (originalKey !== undefined) process.env.XFYUN_API_KEY = originalKey;
      else delete process.env.XFYUN_API_KEY;
      if (originalSecret !== undefined) process.env.XFYUN_API_SECRET = originalSecret;
      else delete process.env.XFYUN_API_SECRET;
    });

    it('XFYUN_API_KEY 缺失时抛错', () => {
      process.env.XFYUN_API_SECRET = 'has-secret';
      expect(() => buildXfyunTtsAuthUrl()).toThrow('XFYUN_API_KEY is not set');
    });

    it('XFYUN_API_SECRET 缺失时抛错', () => {
      process.env.XFYUN_API_KEY = 'has-key';
      expect(() => buildXfyunTtsAuthUrl()).toThrow('XFYUN_API_SECRET is not set');
    });

    it('两件套齐全时生成指向 tts-api 的 wss URL', () => {
      process.env.XFYUN_API_KEY = 'k';
      process.env.XFYUN_API_SECRET = 's';
      const url = buildXfyunTtsAuthUrl();
      const parsed = new URL(url);
      expect(parsed.host).toBe('tts-api.xfyun.cn');
      expect(parsed.pathname).toBe('/v2/tts');
      expect(parsed.searchParams.get('authorization')).toBeTruthy();
    });
  });
});
