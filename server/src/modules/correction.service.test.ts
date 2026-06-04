import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectionService } from './correction.service';
import { createMockLlmClient } from '../lib/llm-client.test';
import type { ILlmClient } from '../lib/llm-client';

describe('CorrectionService', () => {
  let llm: ILlmClient;
  let svc: CorrectionService;

  beforeEach(() => {
    llm = createMockLlmClient();
    svc = new CorrectionService(llm);
  });

  describe('analyze', () => {
    it('正常路径：返回结构化纠错结果', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify([{
          original: 'I very like it',
          corrected: 'I really like it',
          errorType: 'word_choice',
          severity: 'minor',
          explanation: '用 really 修饰动词',
          betterExpression: 'I really enjoy it',
        }]),
      );

      const res = await svc.analyze('I very like it');
      expect(res).toHaveLength(1);
      expect(res[0].corrected).toBe('I really like it');
      expect(res[0].severity).toBe('minor');
      expect(res[0].errorType).toBe('word_choice');
    });

    it('完全正确的句子返回空数组', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue('[]');
      const res = await svc.analyze('I really like it.');
      expect(res).toEqual([]);
    });

    it('LLM 返回 markdown 包裹的 JSON 也能解析', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
        '```json\n[{"original":"he go","corrected":"he goes","errorType":"grammar","severity":"major","explanation":"第三人称单数"}]\n```',
      );
      const res = await svc.analyze('he go');
      expect(res).toHaveLength(1);
      expect(res[0].corrected).toBe('he goes');
    });

    it('LLM 返回非法 JSON 时不抛出，降级为空数组', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue('not a json');
      const res = await svc.analyze('whatever');
      expect(res).toEqual([]);
    });

    it('LLM 调用抛错时向上传播', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
      await expect(svc.analyze('x')).rejects.toThrow('network');
    });

    it('空字符串直接返回空数组，不调用 LLM', async () => {
      const res = await svc.analyze('   ');
      expect(res).toEqual([]);
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('severity 不合法时降级为 minor', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify([{
          original: 'test', corrected: 'test2',
          errorType: 'grammar', severity: 'invalid_sev', explanation: 'test',
        }]),
      );
      const res = await svc.analyze('test');
      expect(res[0].severity).toBe('minor');
    });
  });

  describe('analyzeForTurn', () => {
    it('注入 turnId', async () => {
      (llm.complete as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify([{
          original: 'I very like', corrected: 'I really like',
          errorType: 'word_choice', severity: 'minor', explanation: 'test',
        }]),
      );
      const res = await svc.analyzeForTurn('I very like', 'turn-123');
      expect(res[0].turnId).toBe('turn-123');
    });
  });
});
