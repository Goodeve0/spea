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
