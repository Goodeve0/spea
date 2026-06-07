import WebSocket from 'ws';

import type { PronunciationResult } from '@speak-coach/shared';

import { buildXfyunIseAuthUrl } from '../lib/xfyun-auth';
import { parseXfyunIseXml } from '../lib/xfyun-ise-parser';

import type { IPronunciationService } from './pronunciation-shared';
import { emptyResult, estimateResult, stripWavHeader } from './pronunciation-shared';

const MIN_AUDIO_BYTES = 1280;
const FRAME_SIZE = 1280;
const ISE_TIMEOUT_MS = 30_000;

function buildEnglishSentenceText(referenceText: string): string {
  const cleaned = referenceText.trim();
  return `\uFEFF[content]\n${cleaned}`;
}

/** 科大讯飞语音评测（流式版） */
export class IflytekPronunciationService implements IPronunciationService {
  private readonly appId: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  constructor() {
    this.appId = process.env.XFYUN_APP_ID;
    this.apiKey = process.env.XFYUN_API_KEY;
    this.apiSecret = process.env.XFYUN_API_SECRET;
  }

  async assess(audio: ArrayBuffer, referenceText: string): Promise<PronunciationResult> {
    if (!referenceText.trim()) {
      return emptyResult();
    }

    const pcm = stripWavHeader(audio);
    if (!this.appId || !this.apiKey || !this.apiSecret || pcm.byteLength < MIN_AUDIO_BYTES) {
      return estimateResult(referenceText);
    }

    try {
      const parsed = await this.callIseApi(pcm, referenceText);
      return { ...parsed, turnId: '' };
    } catch {
      return estimateResult(referenceText);
    }
  }

  private callIseApi(pcm: Buffer, referenceText: string): Promise<Omit<PronunciationResult, 'turnId'>> {
    const authUrl = buildXfyunIseAuthUrl(this.apiKey!, this.apiSecret!);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(authUrl);
      let settled = false;
      let finalXml = '';

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        fn();
      };

      const timer = setTimeout(() => {
        finish(() => reject(new Error('XFYUN ISE timeout')));
      }, ISE_TIMEOUT_MS);

      ws.on('error', (err) => {
        finish(() => reject(err));
      });

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            common: { app_id: this.appId },
            business: {
              sub: 'ise',
              ent: 'en_vip',
              category: 'read_sentence',
              cmd: 'ssb',
              text: buildEnglishSentenceText(referenceText),
              tte: 'utf-8',
              ttp_skip: true,
              aue: 'raw',
              auf: 'audio/L16;rate=16000',
              rst: 'entirety',
              ise_unite: '1',
              extra_ability: 'multi_dimension',
              plev: '0',
            },
            data: { status: 0 },
          }),
        );

        this.sendAudioFrames(ws, pcm);
      });

      ws.on('message', (raw) => {
        try {
          const payload = JSON.parse(raw.toString()) as {
            code?: number;
            message?: string;
            data?: { status?: number; data?: string };
          };

          if (payload.code !== 0) {
            finish(() => reject(new Error(payload.message ?? 'XFYUN ISE failed')));
            return;
          }

          if (payload.data?.data) {
            finalXml = Buffer.from(payload.data.data, 'base64').toString('utf8');
          }

          if (payload.data?.status === 2) {
            if (process.env.XFYUN_ISE_DEBUG === '1') {
              console.log('[XFYUN ISE] referenceText:', referenceText);
              console.log('[XFYUN ISE] raw XML:\n', finalXml);
            }
            finish(() => resolve(parseXfyunIseXml(finalXml)));
          }
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error('Invalid XFYUN response')));
        }
      });
    });
  }

  private sendAudioFrames(ws: WebSocket, pcm: Buffer): void {
    const totalFrames = Math.ceil(pcm.length / FRAME_SIZE) || 1;

    for (let i = 0; i < totalFrames; i += 1) {
      const start = i * FRAME_SIZE;
      const chunk = pcm.subarray(start, Math.min(start + FRAME_SIZE, pcm.length));
      const isFirst = i === 0;
      const isLast = i === totalFrames - 1;

      ws.send(
        JSON.stringify({
          business: {
            cmd: 'auw',
            aus: isFirst ? 1 : isLast ? 4 : 2,
          },
          data: {
            status: isLast ? 2 : 1,
            data: chunk.toString('base64'),
          },
        }),
      );
    }
  }
}
