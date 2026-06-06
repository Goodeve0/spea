import type { StoredSession } from '@speak-coach/shared';

const DAY = 86400000;
const WEEKS = 14; // 展示最近 14 周（约一季度）

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 当天练习次数 → 瓜田色阶（空地→发芽→长大→熟瓜） */
const SCALE = ['#EBEDF0', '#C6F0D4', '#7DD957', '#FF9F1C'];
function tint(count: number): string {
  if (count <= 0) return SCALE[0];
  if (count === 1) return SCALE[1];
  if (count === 2) return SCALE[2];
  return SCALE[3];
}

/**
 * 我的瓜田：GitHub/LeetCode 风格热力图。
 * 每格 = 一天，当天练习越多瓜越熟（颜色越暖）。
 */
export default function GardenHeatmap({ sessions }: { sessions: StoredSession[] }) {
  const counts = new Map<number, number>();
  for (const s of sessions) {
    const d = startOfDay(s.timestamp);
    counts.set(d, (counts.get(d) || 0) + 1);
  }

  const today = startOfDay(Date.now());
  const dow = new Date(today).getDay(); // 0=周日
  const lastCellDate = today + (6 - dow) * DAY; // 对齐到本周六
  const firstCellDate = lastCellDate - (WEEKS * 7 - 1) * DAY;

  const columns: { date: number; count: number; future: boolean }[][] = [];
  for (let c = 0; c < WEEKS; c++) {
    const col: { date: number; count: number; future: boolean }[] = [];
    for (let r = 0; r < 7; r++) {
      const date = firstCellDate + (c * 7 + r) * DAY;
      col.push({ date, count: counts.get(date) || 0, future: date > today });
    }
    columns.push(col);
  }

  const totalGua = sessions.length;
  const activeDays = counts.size;

  return (
    <div>
      <p className="text-sm text-sub mb-3">
        已收获 <span className="font-extrabold text-primary">{totalGua}</span> 颗瓜 · 浇水{' '}
        <span className="font-extrabold text-ink">{activeDays}</span> 天
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((cell, ri) =>
                cell.future ? (
                  <div key={ri} className="w-3.5 h-3.5" />
                ) : (
                  <div
                    key={ri}
                    className="w-3.5 h-3.5 rounded-[3px]"
                    style={{ backgroundColor: tint(cell.count) }}
                    title={`${new Date(cell.date).toLocaleDateString('zh-CN')} · ${cell.count} 颗瓜`}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-sub">
        <span>少</span>
        {SCALE.map((c) => (
          <span key={c} className="w-3.5 h-3.5 rounded-[3px]" style={{ backgroundColor: c }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
