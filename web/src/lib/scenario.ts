import { PRESET_SCENARIOS, type Scenario } from '@speak-coach/shared';

const CUSTOM_KEY = 'customScenario';

/** 解析当前要练习的场景：预设按 id 查找；'custom' 读自由话题自定义场景 */
export function getActiveScenario(): Scenario {
  const id =
    (typeof window !== 'undefined' && window.localStorage.getItem('scenarioId')) || 'interview';
  if (id === 'custom') {
    try {
      const raw = window.localStorage.getItem(CUSTOM_KEY);
      if (raw) return JSON.parse(raw) as Scenario;
    } catch {
      /* ignore，落到下面的预设兜底 */
    }
  }
  return PRESET_SCENARIOS.find((s) => s.id === id) ?? PRESET_SCENARIOS[0];
}

/** 持久化自由话题生成的自定义场景 */
export function setCustomScenario(scenario: Scenario): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(scenario));
  } catch {
    /* ignore */
  }
}
