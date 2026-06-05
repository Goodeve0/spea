import crypto from 'crypto';

const ISE_HOST = 'ise-api.xfyun.cn';
const ISE_PATH = '/v2/open-ise';
const TTS_HOST = 'tts-api.xfyun.cn';
const TTS_PATH = '/v2/tts';

/** 生成讯飞 WebSocket 通用鉴权 URL（HMAC-SHA256） */
export function buildXfyunWsAuthUrl(host: string, path: string, apiKey: string, apiSecret: string): string {
  const hostUrl = `wss://${host}${path}`;
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  const params = new URLSearchParams({
    authorization,
    date,
    host,
  });

  return `${hostUrl}?${params.toString()}`;
}

/** 生成科大讯飞语音评测 WebSocket 鉴权 URL */
export function buildXfyunIseAuthUrl(apiKey: string, apiSecret: string): string {
  return buildXfyunWsAuthUrl(ISE_HOST, ISE_PATH, apiKey, apiSecret);
}

/**
 * 生成科大讯飞在线语音合成（TTS）WebSocket 鉴权 URL
 * 从环境变量 XFYUN_API_KEY / XFYUN_API_SECRET 读取凭证。
 */
export function buildXfyunTtsAuthUrl(): string {
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  if (!apiKey) throw new Error('XFYUN_API_KEY is not set');
  if (!apiSecret) throw new Error('XFYUN_API_SECRET is not set');
  return buildXfyunWsAuthUrl(TTS_HOST, TTS_PATH, apiKey, apiSecret);
}
