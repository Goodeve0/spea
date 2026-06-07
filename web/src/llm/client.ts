/**
 * 前端 LLM 客户端
 *
 * 默认走后端代理（VITE_API_BASE_URL），API Key 留在服务端、不进前端 bundle。
 * 若未配置代理地址，则降级为直连上游（需要 VITE_OPENAI_API_KEY，仅用于无后端的独立演示）。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

interface RequestTarget {
  url: string;
  headers: Record<string, string>;
  model: string;
  /** true 表示走后端代理（无需在前端附带 key） */
  viaProxy: boolean;
}

/** 计算请求目标：优先后端代理，否则直连上游 */
function resolveTarget(): RequestTarget {
  const model = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-v3';
  const proxyBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (proxyBase) {
    return {
      url: `${proxyBase.replace(/\/$/, '')}/chat/completions`,
      headers: { 'Content-Type': 'application/json' },
      model,
      viaProxy: true,
    };
  }

  // 降级：直连上游（key 会进入前端 bundle，仅限无后端的演示场景）
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL as string | undefined;
  if (!baseUrl) {
    throw new Error(
      'LLM 未配置：请设置 VITE_API_BASE_URL（推荐，走后端代理）或 VITE_OPENAI_BASE_URL + VITE_OPENAI_API_KEY（直连）。',
    );
  }
  return {
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    model,
    viaProxy: false,
  };
}

/** 读取响应体的前若干字符，便于错误定位 */
async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 带 429 退避重试的 fetch：上游限流（rate limit reached for RPM）时自动等待重试，
 * 把瞬时限流对用户隐藏。最多重试 MAX_RETRIES 次，指数退避 + 抖动。
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const MAX_RETRIES = 2;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
    attempt += 1;
    const backoff = 700 * 2 ** (attempt - 1) + Math.random() * 400;
    console.warn(`[llm] 429 限流，第 ${attempt} 次退避重试，等待 ${Math.round(backoff)}ms`);
    await sleep(backoff);
  }
}

/**
 * 流式对话：逐 token 回调 onToken，返回完整文本。
 * 失败时抛出带 HTTP 状态码与上游响应片段的 Error。
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  options: ChatOptions = {},
): Promise<string> {
  const target = resolveTarget();

  const response = await fetchWithRetry(target.url, {
    method: 'POST',
    headers: target.headers,
    body: JSON.stringify({
      model: target.model,
      messages,
      max_tokens: options.maxTokens ?? 200,
      temperature: options.temperature ?? 0.8,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`LLM 请求失败 (HTTP ${response.status})${body ? `: ${body}` : ''}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    // 极少数环境拿不到流，退回一次性读取
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text) onToken(text);
    return text;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onToken(content);
        }
      } catch {
        // 单行解析失败不影响整体，继续
      }
    }
  }

  return fullText;
}

/** 非流式对话：返回完整文本。失败时抛出带状态码的 Error。 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const target = resolveTarget();

  const response = await fetchWithRetry(target.url, {
    method: 'POST',
    headers: target.headers,
    body: JSON.stringify({
      model: target.model,
      messages,
      max_tokens: options.maxTokens ?? 200,
      temperature: options.temperature ?? 0.8,
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`LLM 请求失败 (HTTP ${response.status})${body ? `: ${body}` : ''}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
