/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 LLM 代理基址，例如 http://localhost:3001/api（推荐） */
  readonly VITE_API_BASE_URL?: string;
  /** LLM 模型名，例如 deepseek-v3 */
  readonly VITE_LLM_MODEL?: string;
  /** 直连上游时的 API Key（仅无后端演示用，会进 bundle） */
  readonly VITE_OPENAI_API_KEY?: string;
  /** 直连上游时的 base url */
  readonly VITE_OPENAI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
