import { describe, it, expect } from 'vitest';

import { parseXfyunIseXml } from '../lib/xfyun-ise-parser';

describe('parseXfyunIseXml', () => {
  it('解析简化结构（分数直接挂在 read_sentence 上）', () => {
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

  it('解析真实嵌套结构（分数在 read_chapter，外层 read_sentence 无分数）', () => {
    // 还原讯飞英文 read_sentence 的真实结构：外层 read_sentence 仅有 lan/type/version
    const xml = `
      <read_sentence lan="en" type="read_sentence" version="2.0">
        <rec_paper>
          <read_chapter content="hello world" accuracy_score="85" fluency_score="90"
            integrity_score="95" standard_score="88" total_score="87">
            <sentence content="hello world">
              <word content="sil" beg_pos="0" end_pos="20"/>
              <word content="hello" total_score="84"/>
              <word content="world" total_score="91"/>
              <word content="fil" beg_pos="80" end_pos="90"/>
            </sentence>
          </read_chapter>
        </rec_paper>
      </read_sentence>
    `;

    const result = parseXfyunIseXml(xml);
    // 关键：分数应从 read_chapter 读取，而非被无分数的 read_sentence 拦截成 0
    expect(result.accuracy).toBe(85);
    expect(result.fluency).toBe(90);
    expect(result.completeness).toBe(95);
    expect(result.prosody).toBe(88);
    // sil / fil 必须被过滤掉，只保留真实单词
    expect(result.wordScores).toEqual([
      { word: 'hello', score: 84 },
      { word: 'world', score: 91 },
    ]);
  });

  it('过滤所有非单词标记（sil/fil/silv/spn）', () => {
    const xml = `
      <read_chapter accuracy_score="70">
        <word content="sil"/>
        <word content="fil"/>
        <word content="silv"/>
        <word content="spn"/>
        <word content="ok" total_score="75"/>
      </read_chapter>
    `;
    const result = parseXfyunIseXml(xml);
    expect(result.wordScores).toEqual([{ word: 'ok', score: 75 }]);
  });

  it('无评测节点时返回零分', () => {
    const result = parseXfyunIseXml('<xml_result></xml_result>');
    expect(result.accuracy).toBe(0);
    expect(result.wordScores).toEqual([]);
  });
});
