/**
 * 讯飞在线语音合成（v2/tts）的音色清单
 * 文档：https://www.xfyun.cn/doc/tts/online_tts/API.html
 *
 * 注意：实际可用音色由你的 AppId 在讯飞控制台的"发音人授权"决定。
 * 若选择某个音色后讯飞返回 `vcn params is empty;code=11119`，说明该 AppId 未授权该 vcn。
 */

export interface IflytekVoice {
  id: string;
  label: string;
  language: 'en-US' | 'zh-CN';
  gender: 'female' | 'male';
}

export const IFLYTEK_VOICES: IflytekVoice[] = [
  // 已开通的中文音色（读英文会带中文口音，仅作为兜底）
  { id: 'x4_xiaoyan', label: '讯飞小燕（女 · 普通话）', language: 'zh-CN', gender: 'female' },
  { id: 'x4_yezi', label: '讯飞小露（女 · 普通话）', language: 'zh-CN', gender: 'female' },
  { id: 'aisjiuxu', label: '讯飞许久（男 · 普通话）', language: 'zh-CN', gender: 'male' },
  { id: 'aisjinger', label: '讯飞小婧（女 · 普通话）', language: 'zh-CN', gender: 'female' },
  { id: 'aisbabyxu', label: '讯飞许小宝（男 · 普通话）', language: 'zh-CN', gender: 'male' },

  // 英文音色（需要在讯飞控制台"领取免费发音人"开通后才能使用）
  { id: 'x4_EnUs_Catherine', label: 'Catherine（女 · 美式 · 需开通）', language: 'en-US', gender: 'female' },
  { id: 'x4_EnUs_Laura', label: 'Laura（女 · 美式 · 需开通）', language: 'en-US', gender: 'female' },
  { id: 'x4_EnUs_Alex', label: 'Alex（男 · 美式 · 需开通）', language: 'en-US', gender: 'male' },
  { id: 'x4_EnUs_Henry', label: 'Henry（男 · 美式 · 需开通）', language: 'en-US', gender: 'male' },
  { id: 'x_EnUs_John', label: 'John（男 · 美式 · 经典 · 需开通）', language: 'en-US', gender: 'male' },
];

export const DEFAULT_IFLYTEK_VOICE = IFLYTEK_VOICES[0].id;
