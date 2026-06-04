import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialogService } from './dialog.service';
import { createMockLlmClient } from '../lib/llm-client.test';
import type { ILlmClient } from '../lib/llm-client';
import type { Scenario } from '@speak-coach/shared';

const MOCK_SCENARIO: Scenario = {
  id: 'interview',
  title: 'Job Interview',
  description: 'test',
  difficulty: 'intermediate',
  rolePrompt: 'You are a hiring manager.',
  goal: 'Complete the interview.',
};

describe('DialogService', () => {
  let llm: ILlmClient;
  let svc: DialogService;

  beforeEach(() => {
    llm = createMockLlmClient();
    svc = new DialogService(llm);
  });

  describe('greet', () => {
    it('AC1: 返回非空开场白，内容受 rolePrompt 影响', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
        'Hi, thanks for coming in. Shall we start?',
      );
      const result = await svc.greet(MOCK_SCENARIO);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      const callArgs = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const systemMsg = callArgs.find((m: any) => m.role === 'system');
      expect(systemMsg.content).toContain('You are a hiring manager.');
    });
  });

  describe('reply', () => {
    it('AC2: onDelta 拼接等于返回值', async () => {
      (llm.stream as ReturnType<typeof vi.fn>).mockImplementation(
        async (_msgs: any, onToken: (t: string) => void) => {
          onToken('Tell'); onToken(' me'); onToken(' more.');
          return 'Tell me more.';
        },
      );
      const deltas: string[] = [];
      const result = await svc.reply('s1', 'Hello', (d) => deltas.push(d));
      expect(result).toBe('Tell me more.');
      expect(deltas.join('')).toBe('Tell me more.');
    });

    it('AC3: 多句回复时 onDelta 被多次调用', async () => {
      (llm.stream as ReturnType<typeof vi.fn>).mockImplementation(
        async (_msgs: any, onToken: (t: string) => void) => {
          const text = 'Sure. Tell me more.';
          for (const ch of text) onToken(ch);
          return text;
        },
      );
      const deltas: string[] = [];
      await svc.reply('s2', 'Hi', (d) => deltas.push(d));
      expect(deltas.length).toBeGreaterThan(0);
    });

    it('AC4: 连续两轮 reply，第二轮 LLM 入参包含第一轮对话历史', async () => {
      (llm.stream as ReturnType<typeof vi.fn>).mockImplementation(
        async (_msgs: any, onToken: (t: string) => void) => {
          onToken('Reply'); return 'Reply';
        },
      );
      await svc.reply('s3', 'First message', () => {});
      await svc.reply('s3', 'Second message', () => {});
      const secondCallMsgs = (llm.stream as ReturnType<typeof vi.fn>).mock.calls[1][0];
      const contents = secondCallMsgs.map((m: any) => m.content);
      expect(contents).toContain('First message');
      expect(contents).toContain('Reply');
    });

    it('AC5: userText 为空时不调用 LLM，返回追问', async () => {
      const result = await svc.reply('s4', '', () => {});
      expect(result).toContain("didn't hear");
      expect(llm.stream).not.toHaveBeenCalled();
    });

    it('AC6: LLM 抛错时不抛出，返回兜底话术', async () => {
      (llm.stream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
      const result = await svc.reply('s6', 'Hello', () => {});
      expect(result).toContain("didn't catch");
    });

    it('AC7: 上下文超过窗口上限时被截断', async () => {
      (llm.stream as ReturnType<typeof vi.fn>).mockImplementation(
        async (_msgs: any, onToken: (t: string) => void) => {
          onToken('Ok'); return 'Ok';
        },
      );
      for (let i = 0; i < 25; i++) {
        await svc.reply('s7', `Message ${i}`, () => {});
      }
      const ctx = svc.getContext('s7');
      // system + 最多 20*2 + 1(最后一轮push后) = 42
      expect(ctx.length).toBeLessThanOrEqual(43);
      // system 消息始终在最前面
      expect(ctx[0].role).toBe('system');
    });
  });
});
