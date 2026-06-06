import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario } from '@speak-coach/shared';

vi.mock('./client', () => ({ chat: vi.fn() }));

import { chat } from './client';
import { generateHints, parseHints } from './hint-generator';

const scenario: Scenario = {
  id: 'interview',
  title: 'Job Interview',
  description: '',
  difficulty: 'intermediate',
  rolePrompt: '',
  goal: '',
};

describe('parseHints', () => {
  it('解析合法 JSON', () => {
    const r = parseHints('{"opener":"I think","suggestions":["I have 3 years of experience.","I enjoy teamwork."]}');
    expect(r).toEqual({
      opener: 'I think',
      suggestions: ['I have 3 years of experience.', 'I enjoy teamwork.'],
    });
  });

  it('容忍多余文字与代码围栏', () => {
    const r = parseHints('Sure!\n```json\n{"opener":"Well","suggestions":["Yes, I do."]}\n```');
    expect(r?.suggestions).toEqual(['Yes, I do.']);
  });

  it('suggestions 为空时返回 null', () => {
    expect(parseHints('{"opener":"x","suggestions":[]}')).toBeNull();
  });

  it('非 JSON 文本返回 null', () => {
    expect(parseHints('no json here')).toBeNull();
  });

  it('最多保留 3 条建议', () => {
    const r = parseHints('{"opener":"","suggestions":["a","b","c","d"]}');
    expect(r?.suggestions).toHaveLength(3);
  });

  it('过滤空白建议', () => {
    const r = parseHints('{"opener":"","suggestions":["  ","ok"]}');
    expect(r?.suggestions).toEqual(['ok']);
  });
});

describe('generateHints', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('成功时返回解析后的提示', async () => {
    vi.mocked(chat).mockResolvedValue('{"opener":"I","suggestions":["Hello, nice to meet you."]}');
    const r = await generateHints(scenario, 'Tell me about yourself', 'intermediate');
    expect(r?.suggestions[0]).toBe('Hello, nice to meet you.');
  });

  it('chat 抛错时静默返回 null', async () => {
    vi.mocked(chat).mockRejectedValue(new Error('boom'));
    const r = await generateHints(scenario, 'Q', 'beginner');
    expect(r).toBeNull();
  });

  it('返回非法内容时返回 null', async () => {
    vi.mocked(chat).mockResolvedValue('garbage');
    const r = await generateHints(scenario, 'Q', 'beginner');
    expect(r).toBeNull();
  });
});
