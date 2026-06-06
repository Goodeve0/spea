/**
 * useConversationLlm
 *
 * 封装对话页面的 LLM 交互逻辑：
 *  - buildMessages()    — 构建发往 LLM 的消息列表（系统提示 + 历史 + 本轮输入）
 *  - handleUserMessage()— 添加用户消息 → streamChat → 添加 AI 回复 → 触发 TTS
 *
 * 对外暴露：
 *  - isLoading          — LLM 正在流式生成中
 *  - handleUserMessage(text) — 处理用户输入（异步，内部管理 loading/错误）
 *
 * 依赖注入（通过 options）：
 *  - onAiReply(turnId, text) — AI 消息写入后回调（供 Conversation 触发 TTS）
 *  - onError(msg)            — LLM 调用失败时回调（供 Conversation 展示 notice）
 *  - onBeforeMessage()       — 每次发消息前的钩子（如 stopSpeaking）
 */
import { useState, useCallback } from 'react';
import type { Scenario } from '@speak-coach/shared';
import { streamChat, type ChatMessage } from '../llm/client';
import { stripMarkdown } from '../llm/strip-markdown';
import { useSessionStore } from '../store/session';

interface UseConversationLlmOptions {
  scenario: Scenario;
  onAiReply: (turnId: string, text: string) => void;
  onError?: (message: string) => void;
  onBeforeMessage?: () => void;
}

export interface ConversationLlmHandle {
  isLoading: boolean;
  handleUserMessage: (text: string) => Promise<void>;
}

export function useConversationLlm({
  scenario,
  onAiReply,
  onError,
  onBeforeMessage,
}: UseConversationLlmOptions): ConversationLlmHandle {
  const [isLoading, setIsLoading] = useState(false);
  const { addTurn, setAiSpeaking, appendAiText, resetAiText } = useSessionStore();

  /**
   * 构建发给 LLM 的消息列表（从 store 读最新历史，避免闭包过期）
   */
  const buildMessages = useCallback(
    (userText: string): ChatMessage[] => {
      const history = useSessionStore.getState().turns;
      return [
        {
          role: 'system',
          content:
            scenario.rolePrompt +
            '\n\nConversation goal: ' +
            scenario.goal +
            '\n\nIMPORTANT style rules — this is a SPOKEN conversation:' +
            '\n- Stay fully in character at all times. Never break role to give writing tips, resume advice, or meta commentary.' +
            '\n- Reply the way a real person would SPEAK: short and natural, usually 1-2 sentences.' +
            '\n- Plain conversational text ONLY. Do NOT use markdown, bullet points, numbered lists, bold/asterisks, or headings.' +
            '\n- Ask one simple follow-up question to keep the conversation going.',
        },
        ...history.map((t) => ({
          role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: t.text,
        })),
        { role: 'user', content: userText },
      ];
    },
    [scenario],
  );

  const handleUserMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      onBeforeMessage?.();

      // 先用最新历史构建消息，再把用户消息入库（避免重复计入本轮）
      const messages = buildMessages(text);
      addTurn({
        id: `user-${Date.now()}`,
        sessionId: 'local-session',
        role: 'user',
        text,
        timestamp: Date.now(),
      });

      setIsLoading(true);
      setAiSpeaking(true);
      resetAiText();

      try {
        const reply = await streamChat(messages, (chunk) => appendAiText(chunk));
        // 清理模型可能残留的 markdown 符号，用于显示与朗读
        const finalReply =
          stripMarkdown(reply).trim() ||
          "Sorry, I didn't catch that. Could you say it again?";
        const aiTurnId = `ai-${Date.now()}`;
        addTurn({
          id: aiTurnId,
          sessionId: 'local-session',
          role: 'ai',
          text: finalReply,
          timestamp: Date.now(),
        });
        resetAiText();
        onAiReply(aiTurnId, finalReply);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[useConversationLlm] LLM 调用失败:', detail);
        onError?.(`AI 回复失败：${detail}`);
        addTurn({
          id: `ai-${Date.now()}`,
          sessionId: 'local-session',
          role: 'ai',
          text: "I'm having trouble responding right now. Please try again in a moment.",
          timestamp: Date.now(),
        });
        resetAiText();
        setAiSpeaking(false);
      } finally {
        setIsLoading(false);
      }
    },
    [addTurn, appendAiText, buildMessages, onAiReply, onBeforeMessage, onError, resetAiText, setAiSpeaking],
  );

  return { isLoading, handleUserMessage };
}
