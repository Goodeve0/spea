import { afterEach, describe, expect, it } from 'vitest';

import {
  createPronunciationService,
  EstimatePronunciationService,
  IflytekPronunciationService,
  AzurePronunciationService,
  resolvePronunciationProvider,
} from './pronunciation.service';

describe('createPronunciationService', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('显式指定 iflytek', () => {
    const svc = createPronunciationService('iflytek');
    expect(svc).toBeInstanceOf(IflytekPronunciationService);
  });

  it('显式指定 azure', () => {
    const svc = createPronunciationService('azure');
    expect(svc).toBeInstanceOf(AzurePronunciationService);
  });

  it('显式指定 estimate', () => {
    const svc = createPronunciationService('estimate');
    expect(svc).toBeInstanceOf(EstimatePronunciationService);
  });

  it('未指定时按凭证自动推断 iflytek', () => {
    delete process.env.PRONUNCIATION_PROVIDER;
    process.env.XFYUN_APP_ID = 'app';
    process.env.XFYUN_API_KEY = 'key';
    process.env.XFYUN_API_SECRET = 'secret';
    delete process.env.AZURE_SPEECH_KEY;

    expect(resolvePronunciationProvider()).toBe('iflytek');
  });

  it('未指定且无讯飞凭证时推断 azure', () => {
    delete process.env.PRONUNCIATION_PROVIDER;
    delete process.env.XFYUN_APP_ID;
    delete process.env.XFYUN_API_KEY;
    delete process.env.XFYUN_API_SECRET;
    process.env.AZURE_SPEECH_KEY = 'azure-key';

    expect(resolvePronunciationProvider()).toBe('azure');
  });

  it('无任何凭证时降级 estimate', () => {
    delete process.env.PRONUNCIATION_PROVIDER;
    delete process.env.XFYUN_APP_ID;
    delete process.env.XFYUN_API_KEY;
    delete process.env.XFYUN_API_SECRET;
    delete process.env.AZURE_SPEECH_KEY;

    expect(resolvePronunciationProvider()).toBe('estimate');
  });
});
