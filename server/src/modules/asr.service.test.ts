import { describe, it, expect } from 'vitest';
import { MockAsrService } from './asr.service';

describe('AsrService (Mock)', () => {
  it('createStream 返回可用的 stream', () => {
    const svc = new MockAsrService();
    const stream = svc.createStream();
    expect(stream).toBeTruthy();
    expect(typeof stream.push).toBe('function');
    expect(typeof stream.close).toBe('function');
  });

  it('push 后 close 触发 onFinal 回调', async () => {
    const svc = new MockAsrService();
    svc.setMockResults(['Hello world']);
    const stream = svc.createStream();

    const finals: string[] = [];
    stream.onFinal((text) => finals.push(text));

    stream.push(new ArrayBuffer(8));
    await stream.close();

    expect(finals).toEqual(['Hello world']);
  });

  it('多次 close 只触发一次 final', async () => {
    const svc = new MockAsrService();
    svc.setMockResults(['Test']);
    const stream = svc.createStream();

    const finals: string[] = [];
    stream.onFinal((text) => finals.push(text));

    await stream.close();
    await stream.close();

    expect(finals).toEqual(['Test']);
  });

  it('多个 stream 依次返回不同结果', async () => {
    const svc = new MockAsrService();
    svc.setMockResults(['First', 'Second']);

    const s1 = svc.createStream();
    const r1: string[] = [];
    s1.onFinal((t) => r1.push(t));
    await s1.close();

    const s2 = svc.createStream();
    const r2: string[] = [];
    s2.onFinal((t) => r2.push(t));
    await s2.close();

    expect(r1).toEqual(['First']);
    expect(r2).toEqual(['Second']);
  });

  it('无 mock 结果时返回空字符串', async () => {
    const svc = new MockAsrService();
    const stream = svc.createStream();
    const finals: string[] = [];
    stream.onFinal((t) => finals.push(t));
    await stream.close();
    expect(finals).toEqual(['']);
  });
});
