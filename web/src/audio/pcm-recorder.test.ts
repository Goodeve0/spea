import { describe, it, expect } from 'vitest';
import {
  mergeFloat32,
  lowPassFilter,
  downsample,
  floatToInt16,
  PcmRecorder,
} from './pcm-recorder';

describe('mergeFloat32', () => {
  it('合并多段为一段，顺序保持', () => {
    const merged = mergeFloat32([
      new Float32Array([1, 2]),
      new Float32Array([3]),
      new Float32Array([4, 5]),
    ]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5]);
  });

  it('空输入返回空', () => {
    expect(mergeFloat32([]).length).toBe(0);
  });
});

describe('downsample', () => {
  it('48k → 16k 长度约为 1/3', () => {
    const input = new Float32Array(48000); // 1 秒 @ 48k
    const out = downsample(input, 48000, 16000);
    // floor(48000 / 3) = 16000
    expect(out.length).toBe(16000);
  });

  it('toRate >= fromRate 时原样返回', () => {
    const input = new Float32Array([1, 2, 3]);
    expect(downsample(input, 16000, 16000)).toBe(input);
    expect(downsample(input, 16000, 48000)).toBe(input);
  });

  it('空输入返回空', () => {
    expect(downsample(new Float32Array(0), 48000, 16000).length).toBe(0);
  });

  it('线性插值：常量信号保持常量', () => {
    const input = new Float32Array(300).fill(0.5);
    const out = downsample(input, 48000, 16000);
    for (const v of out) expect(v).toBeCloseTo(0.5, 5);
  });
});

describe('floatToInt16', () => {
  it('范围 clamp 到 [-32768, 32767]', () => {
    const out = floatToInt16(new Float32Array([2, -2, 0]));
    expect(out[0]).toBe(32767); // +1 → 0x7fff
    expect(out[1]).toBe(-32768); // -1 → -0x8000
    expect(out[2]).toBe(0);
  });

  it('正常范围线性映射', () => {
    const out = floatToInt16(new Float32Array([0.5, -0.5]));
    expect(out[0]).toBe(Math.trunc(0.5 * 0x7fff));
    expect(out[1]).toBe(Math.trunc(-0.5 * 0x8000));
  });

  it('空输入返回空', () => {
    expect(floatToInt16(new Float32Array(0)).length).toBe(0);
  });
});

describe('lowPassFilter', () => {
  it('对最高频信号（每样本翻转）有明显衰减', () => {
    // 奈奎斯特频率方波：+1,-1,+1,-1...，应被低通大幅压制
    const n = 1000;
    const input = new Float32Array(n);
    for (let i = 0; i < n; i++) input[i] = i % 2 === 0 ? 1 : -1;

    const out = lowPassFilter(input, 48000, 7200);
    // 衰减后能量应远小于原始（原始每点 |1|，滤波后均值趋近 0）
    let energy = 0;
    for (let i = 10; i < n; i++) energy += out[i] * out[i];
    const avgEnergy = energy / (n - 10);
    expect(avgEnergy).toBeLessThan(0.3); // 原始为 1.0
  });

  it('对直流（常量）信号几乎无衰减', () => {
    const input = new Float32Array(500).fill(0.8);
    const out = lowPassFilter(input, 48000, 7200);
    // 稳态后应接近原值
    expect(out[out.length - 1]).toBeCloseTo(0.8, 5);
  });

  it('空输入返回空', () => {
    expect(lowPassFilter(new Float32Array(0), 48000, 7200).length).toBe(0);
  });
});

describe('PcmRecorder.isSupported', () => {
  it('jsdom 环境下不应抛错（返回布尔）', () => {
    expect(typeof PcmRecorder.isSupported()).toBe('boolean');
  });
});
