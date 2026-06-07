import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { PronunciationResult } from '@speak-coach/shared';

import { createPronunciationRouter } from './pronunciation.routes';
import { errorMiddleware } from './errors';
import type { IPronunciationService } from '../modules/pronunciation.service';

/** 可控的 mock 评测服务 */
class MockService implements IPronunciationService {
  public lastAudioBytes = 0;
  public lastReference = '';
  async assess(audio: ArrayBuffer, referenceText: string): Promise<PronunciationResult> {
    this.lastAudioBytes = audio.byteLength;
    this.lastReference = referenceText;
    return {
      turnId: '', // 路由层会回填
      accuracy: 88,
      fluency: 82,
      completeness: 90,
      prosody: 79,
      wordScores: [{ word: 'hello', score: 91 }],
    };
  }
}

let server: Server;
let base = '';
let mock: MockService;

beforeAll(async () => {
  mock = new MockService();
  const app = express();
  app.use('/', createPronunciationRouter(mock));
  app.use(errorMiddleware);
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

function postPcm(query: string, body: Uint8Array | null) {
  let blob: Blob | undefined;
  if (body) {
    const ab = new ArrayBuffer(body.length);
    new Uint8Array(ab).set(body);
    blob = new Blob([ab]);
  }
  return fetch(`${base}/pronunciation/assess${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
}

describe('POST /pronunciation/assess', () => {
  it('正常评测返回声学分，turnId 被回填', async () => {
    const pcm = new Uint8Array(1280).fill(1); // 模拟 PCM
    const res = await postPcm('?referenceText=hello%20world&turnId=turn-42', pcm);
    expect(res.status).toBe(200);

    const data = (await res.json()) as PronunciationResult;
    expect(data.accuracy).toBe(88);
    expect(data.turnId).toBe('turn-42');
    expect(data.wordScores).toHaveLength(1);

    // 服务层确实收到音频与参考文本
    expect(mock.lastAudioBytes).toBe(1280);
    expect(mock.lastReference).toBe('hello world');
  });

  it('缺少 referenceText 返回 400', async () => {
    const pcm = new Uint8Array(1280).fill(1);
    const res = await postPcm('?turnId=turn-1', pcm);
    expect(res.status).toBe(400);
  });

  it('空 body 返回 400', async () => {
    const res = await postPcm('?referenceText=hi', null);
    expect(res.status).toBe(400);
  });

  it('turnId 缺省时回填为空字符串', async () => {
    const pcm = new Uint8Array(640).fill(2);
    const res = await postPcm('?referenceText=test', pcm);
    expect(res.status).toBe(200);
    const data = (await res.json()) as PronunciationResult;
    expect(data.turnId).toBe('');
  });
});
