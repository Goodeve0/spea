import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });
import { OpenAILlmClient } from './lib/llm-client';
import { DialogService } from './modules/dialog.service';
import { CorrectionService } from './modules/correction.service';
import { ReportService } from './modules/report.service';
import { OpenAIAsrService } from './modules/asr.service';
import { IflytekTtsService, OpenAITtsService } from './modules/tts.service';
import { createPronunciationService, resolvePronunciationProvider } from './modules/pronunciation.service';
import { WsGateway } from './gateway/ws-gateway';
import { createHttpApp } from './http/app';

async function bootstrap() {
  // ── 安全检查：JWT_SECRET 弱密钥 ──────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET;
  const INSECURE_DEFAULTS = ['please-change-in-prod', 'changeme', 'secret', 'jwt-secret'];
  if (!jwtSecret) {
    console.warn(
      '[security] ⚠️  JWT_SECRET 未设置！将使用不安全的默认值，请在 .env 中配置强随机串。',
    );
  } else if (jwtSecret.length < 32 || INSECURE_DEFAULTS.includes(jwtSecret)) {
    console.warn(
      `[security] ⚠️  JWT_SECRET 过短或使用了已知的不安全默认值（"${jwtSecret.slice(0, 8)}…"）。` +
        ' 生产部署前请替换为至少 32 位随机字符串。',
    );
  }

  const llm = new OpenAILlmClient();
  const dialogService = new DialogService(llm);
  const correctionService = new CorrectionService(llm);
  const reportService = new ReportService(llm);
  const asrService = new OpenAIAsrService();
  const ttsService = new OpenAITtsService();
  const iflytekTtsService = new IflytekTtsService();
  const pronunciationService = createPronunciationService();

  const gateway = new WsGateway(
    dialogService,
    correctionService,
    reportService,
    asrService,
    ttsService,
    pronunciationService,
    iflytekTtsService,
  );

  const wsPort = parseInt(process.env.WS_PORT ?? '3001', 10);
  gateway.start(wsPort);

  // HTTP API（账号 / 数据持久化），与 WS 并存
  const httpPort = parseInt(process.env.HTTP_PORT ?? '3002', 10);
  createHttpApp().listen(httpPort, () => {
    console.log(`HTTP API running on http://localhost:${httpPort}`);
  });

  const pronunciationProvider = resolvePronunciationProvider(process.env.PRONUNCIATION_PROVIDER);
  console.log(`WebSocket server running on ws://localhost:${wsPort}`);
  console.log(`Pronunciation provider: ${pronunciationProvider}`);
  console.log(`Open http://localhost:5173 in your browser to use the app`);
}

bootstrap();
