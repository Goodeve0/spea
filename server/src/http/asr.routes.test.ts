import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';

import { normalizeTranscript } from '@speak-coach/shared';

import { createAsrRouter, cleanSenseVoiceText, type Transcriber } from './asr.routes';
import { errorMiddleware } from './errors';

let server: Server;
let base = '';
let lastBytes = 0;

const mockTranscribe: Transcriber = async (wav) => {
  lastBytes = wav.length;
  return 'hello world';
};

beforeAll(async () => {
  const app = express();
  app.use('/', createAsrRouter(mockTranscribe));
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

describe('POST /asr', () => {
  it('正常转写返回 text', async () => {
    const ab = new ArrayBuffer(1024);
    new Uint8Array(ab).fill(1);
    const res = await fetch(`${base}/asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: new Blob([ab]),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { text: string };
    expect(data.text).toBe('hello world');
    expect(lastBytes).toBe(1024);
  });

  it('空 body 返回 400', async () => {
    const res = await fetch(`${base}/asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
    });
    expect(res.status).toBe(400);
  });
});

describe('cleanSenseVoiceText', () => {
  it('去掉情感 emoji 与控制标记', () => {
    expect(cleanSenseVoiceText('Hello world.😊')).toBe('Hello world.');
    expect(cleanSenseVoiceText('<|en|><|HAPPY|>Nice to meet you')).toBe('Nice to meet you');
    expect(cleanSenseVoiceText('  hi   there  ')).toBe('hi there');
  });
});

describe('siliconflow → cleanSenseVoiceText → normalizeTranscript pipeline', () => {
  // 路由层 mock 的 transcribe 不经 siliconflowTranscriber，这里直接验证「清洗 + 规范化」的组合行为。
  const pipeline = (raw: string): string => normalizeTranscript(cleanSenseVoiceText(raw));

  it('补句首大写与句末点', () => {
    expect(pipeline('holidays this is my first time to speak'))
      .toBe('Holidays this is my first time to speak.');
  });

  it('剥控制标记和情感 emoji 后再规范化', () => {
    expect(pipeline('<|en|><|NEUTRAL|>holidays this is my first time to speak😊'))
      .toBe('Holidays this is my first time to speak.');
  });

  it('疑问词起句补问号', () => {
    expect(pipeline('where are you from')).toBe('Where are you from?');
  });

  it('上游已带标点保持不动', () => {
    expect(pipeline('Holidays, this is my first time to speak.'))
      .toBe('Holidays, this is my first time to speak.');
  });
});
