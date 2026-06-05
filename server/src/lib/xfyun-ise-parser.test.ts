import { describe, it, expect } from 'vitest';

import { parseXfyunIseXml } from '../lib/xfyun-ise-parser';

describe('parseXfyunIseXml', () => {
  it('解析英文句子评测 XML 为四维评分', () => {
    const xml = `
      <read_sentence accuracy_score="88.5" fluency_score="76.2"
        integrity_score="92.0" standard_score="80.1" total_score="85.0">
        <word content="hello" total_score="90.0"/>
        <word content="world" total_score="82.0"/>
      </read_sentence>
    `;

    const result = parseXfyunIseXml(xml);
    expect(result.accuracy).toBe(89);
    expect(result.fluency).toBe(76);
    expect(result.completeness).toBe(92);
    expect(result.prosody).toBe(80);
    expect(result.wordScores).toEqual([
      { word: 'hello', score: 90 },
      { word: 'world', score: 82 },
    ]);
  });

  it('无评测节点时返回零分', () => {
    const result = parseXfyunIseXml('<xml_result></xml_result>');
    expect(result.accuracy).toBe(0);
    expect(result.wordScores).toEqual([]);
  });
});
