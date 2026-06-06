import type { WsMessage, ClientMessageType, ClientPayload, Difficulty } from '@speak-coach/shared';

type MessageHandler = (msg: WsMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url?: string) {
    this.url = url ?? `ws://${window.location.hostname}:3001`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        this.handlers.forEach((h) => h(msg));
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      this.scheduleReconnect();
    };

    this.ws.onerror = (e) => {
      console.error('WebSocket error', e);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  send(type: ClientMessageType, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send');
      return;
    }
    this.ws.send(JSON.stringify({ type, payload }));
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** 等待连接进入 OPEN；超时则 reject。用于发送前确保通道就绪。 */
  waitForOpen(timeoutMs = 5000): Promise<void> {
    if (this.isOpen()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (this.isOpen()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          reject(new Error('WebSocket connection timeout'));
        }
      }, 50);
    });
  }

  startSession(scenarioId: string, difficulty: Difficulty): void {
    this.send('session.start', { scenarioId, difficulty } as ClientPayload.SessionStart);
  }

  sendAudioChunk(seq: number): void {
    this.send('audio.chunk', { seq } as ClientPayload.AudioChunk);
  }

  sendAudioEnd(): void {
    this.send('audio.end', {});
  }

  endSession(): void {
    this.send('session.end', {});
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}

/** 全局单例 */
let client: WsClient | null = null;

export function getWsClient(): WsClient {
  if (!client) {
    client = new WsClient();
  }
  return client;
}
