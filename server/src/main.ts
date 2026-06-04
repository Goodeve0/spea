import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });
import { OpenAILlmClient } from './lib/llm-client';
import { DialogService } from './modules/dialog.service';
import { CorrectionService } from './modules/correction.service';
import { ReportService } from './modules/report.service';
import { OpenAIAsrService } from './modules/asr.service';
import { OpenAITtsService } from './modules/tts.service';
import { AzurePronunciationService } from './modules/pronunciation.service';
import { WsGateway } from './gateway/ws-gateway';

async function bootstrap() {
  const llm = new OpenAILlmClient();
  const dialogService = new DialogService(llm);
  const correctionService = new CorrectionService(llm);
  const reportService = new ReportService(llm);
  const asrService = new OpenAIAsrService();
  const ttsService = new OpenAITtsService();
  const pronunciationService = new AzurePronunciationService();

  const gateway = new WsGateway(
    dialogService,
    correctionService,
    reportService,
    asrService,
    ttsService,
    pronunciationService,
  );

  const wsPort = parseInt(process.env.WS_PORT ?? '3001', 10);
  gateway.start(wsPort);

  console.log(`WebSocket server running on ws://localhost:${wsPort}`);
  console.log(`Open http://localhost:5173 in your browser to use the app`);
}

bootstrap();
