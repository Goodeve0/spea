import type { ILlmClient } from '../lib/llm-client';
import type { Scenario } from '@speak-coach/shared';

/** 对话上下文消息 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 对话服务接口 */
export interface IDialogService {
  /** 生成场景开场白 */
  greet(scenario: Scenario): Promise<string>;

  /** 流式生成 AI 回复，onDelta 按句粒度回调 */
  reply(
    sessionId: string,
    userText: string,
    onDelta: (delta: string) => void,
  ): Promise<string>;
}

/** 上下文窗口上限（保留最近 N 轮，不含 system） */
const MAX_CONTEXT_ROUNDS = 20;

/** 兜底追问话术 */
const FALLBACK_FOLLOW_UP = "I'm sorry, I didn't catch that. Could you say that again?";

/** 用户空输入时的追问 */
const EMPTY_INPUT_FOLLOW_UP = "Sorry, I didn't hear anything. Could you try again?";

/** 难度调节指令 */
const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  beginner: 'Use simple vocabulary and short sentences. Speak slowly and clearly. Be encouraging.',
  intermediate: 'Use moderate vocabulary and sentence length. Maintain a natural pace.',
  advanced: 'Use rich vocabulary and complex sentence structures. Speak at a natural pace. Introduce idiomatic expressions.',
};

export class DialogService implements IDialogService {
  /** 按 sessionId 维护对话上下文（黑客松期用内存） */
  private contexts = new Map<string, ChatMessage[]>();

  constructor(private readonly llm: ILlmClient) {}

  async greet(scenario: Scenario): Promise<string> {
    // 初始化上下文
    const systemMsg = this.buildSystemMessage(scenario);
    const messages: ChatMessage[] = [systemMsg];
    this.contexts.set(scenario.id, messages);

    // 用 LLM 生成开场白
    const greeting = await this.llm.complete([
      ...messages,
      { role: 'user', content: '[The conversation is starting. Please greet me as your role.]' },
    ]);

    // 记入上下文
    messages.push(
      { role: 'user', content: '[Start]' },
      { role: 'assistant', content: greeting },
    );

    return greeting;
  }

  async reply(
    sessionId: string,
    userText: string,
    onDelta: (delta: string) => void,
  ): Promise<string> {
    // AC5: 空输入不调 LLM
    if (!userText.trim()) {
      return EMPTY_INPUT_FOLLOW_UP;
    }

    const messages = this.getOrCreateContext(sessionId);

    // 追加用户消息
    messages.push({ role: 'user', content: userText });

    // 截断超长上下文
    this.trimContext(messages);

    try {
      const fullText = await this.llm.stream(messages, (token) => {
        onDelta(token);
      });

      // 追加 AI 回复到上下文
      messages.push({ role: 'assistant', content: fullText });

      return fullText;
    } catch {
      // AC6: LLM 抛错时返回兜底话术，不抛断对话
      messages.pop(); // 撤回用户消息（本轮无效）
      return FALLBACK_FOLLOW_UP;
    }
  }

  /** 获取或创建上下文 */
  private getOrCreateContext(sessionId: string): ChatMessage[] {
    let ctx = this.contexts.get(sessionId);
    if (!ctx) {
      ctx = [{ role: 'system', content: 'You are a helpful English conversation partner.' }];
      this.contexts.set(sessionId, ctx);
    }
    return ctx;
  }

  /** 构造 system message */
  private buildSystemMessage(scenario: Scenario): ChatMessage {
    const difficultyHint = DIFFICULTY_INSTRUCTIONS[scenario.difficulty] ?? '';
    return {
      role: 'system',
      content: [
        scenario.rolePrompt,
        difficultyHint,
        `Conversation goal: ${scenario.goal}`,
        'Keep your responses concise (1-3 sentences). Stay in character.',
      ].join('\n\n'),
    };
  }

  /** 截断超长上下文（保留 system + 最近 N 轮） */
  private trimContext(messages: ChatMessage[]): void {
    const systemMsg = messages[0];
    const nonSystem = messages.slice(1);
    // 每 2 条消息 = 1 轮（user + assistant）
    const maxMessages = MAX_CONTEXT_ROUNDS * 2;
    if (nonSystem.length > maxMessages) {
      const trimmed = nonSystem.slice(-maxMessages);
      messages.length = 0;
      messages.push(systemMsg, ...trimmed);
    }
  }

  /** 测试辅助：获取某 session 的上下文 */
  getContext(sessionId: string): ChatMessage[] {
    return this.contexts.get(sessionId) ?? [];
  }

  /** 测试辅助：清理所有上下文 */
  clearAllContexts(): void {
    this.contexts.clear();
  }
}
