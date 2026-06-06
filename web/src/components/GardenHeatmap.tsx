import { useState } from 'react';
import type { StoredSession } from '@speak-coach/shared';

const DAY = 86400000;
const WEEKS = 52; // 展示一整年（52 周 ≈ 364 天）

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

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const DOW_LABELS = ['日', '一', '三', '五']; // 仅展示部分避免拥挤（0,2,4 行）

/** 取某年的最早 session 所在年 */
function getAvailableYears(sessions: StoredSession[]): number[] {
  if (sessions.length === 0) return [new Date().getFullYear()];
  const years = new Set(sessions.map((s) => new Date(s.timestamp).getFullYear()));
  const currentYear = new Date().getFullYear();
  years.add(currentYear);
  return [...years].sort((a, b) => b - a); // 倒序，最新在前
}

/**
 * 我的瓜田：GitHub/LeetCode 风格热力图。
 * 每格 = 一天，当天练习越多瓜越熟（颜色越暖）。
 * 支持年份切换，顶部显示月份标签。
 */
export default function GardenHeatmap({ sessions }: { sessions: StoredSession[] }) {
  const currentYear = new Date().getFullYear();
  const availableYears = getAvailableYears(sessions);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 按天计数（全量，不限年份，供统计摘要）
  const allCounts = new Map<number, number>();
  for (const s of sessions) {
    const d = startOfDay(s.timestamp);
    allCounts.set(d, (allCounts.get(d) || 0) + 1);
  }

  // 计算所选年的热力图范围
  // 从所选年 1 月 1 日往前找到周日，一直到 12 月 31 日后的周六（完整 52-53 周）
  const yearStart = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear, 11, 31);

  // 对齐：找到 yearStart 前的最近周日
  const startDow = yearStart.getDay();
  const firstCellDate = startOfDay(yearStart.getTime()) - startDow * DAY;

  // 对齐：找到 yearEnd 后的最近周六
  const endDow = yearEnd.getDay();
  const lastCellDate = startOfDay(yearEnd.getTime()) + (6 - endDow) * DAY;

  const totalDays = Math.round((lastCellDate - firstCellDate) / DAY) + 1;
  const totalCols = Math.ceil(totalDays / 7);

  const today = startOfDay(Date.now());

  // 构建列数据
  const columns: { date: number; count: number; future: boolean }[][] = [];
  for (let c = 0; c < totalCols; c++) {
    const col: { date: number; count: number; future: boolean }[] = [];
    for (let r = 0; r < 7; r++) {
      const date = firstCellDate + (c * 7 + r) * DAY;
      const inYear = new Date(date).getFullYear() === selectedYear;
      col.push({
        date,
        count: inYear ? (allCounts.get(date) || 0) : -1, // -1 = 超出所选年，灰空
        future: date > today,
      });
    }
    columns.push(col);
  }

  // 月份标签：每列第一天属于哪个月，月份变化时打标签
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((col, ci) => {
    const firstInYear = col.find((cell) => cell.count !== -1 || cell.future);
    if (!firstInYear) return;
    const m = new Date(firstInYear.date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: ci, label: MONTH_NAMES[m] });
      lastMonth = m;
    }
  });

  // 本年统计
  const yearSessions = sessions.filter((s) => new Date(s.timestamp).getFullYear() === selectedYear);
  const yearCounts = new Map<number, number>();
  for (const s of yearSessions) {
    const d = startOfDay(s.timestamp);
    yearCounts.set(d, (yearCounts.get(d) || 0) + 1);
  }
  const yearActiveDays = yearCounts.size;
  const yearTotal = yearSessions.length;

  return (
    <div>
      {/* 年份切换 + 统计摘要 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-sub">
          {selectedYear} 年收获{' '}
          <span className="font-extrabold text-primary">{yearTotal}</span> 颗瓜 · 浇水{' '}
          <span className="font-extrabold text-ink">{yearActiveDays}</span> 天
        </p>
        {availableYears.length > 1 && (
          <div className="flex gap-1">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-colors ${
                  y === selectedYear
                    ? 'bg-primary text-white'
                    : 'text-sub hover:text-ink hover:bg-canvas'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-0">
          {/* 星期几标签列 */}
          <div className="flex flex-col gap-[3px] mr-1 pt-5">
            {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
              <div key={i} className="h-[14px] flex items-center">
                {(i === 0 || i === 2 || i === 4) ? (
                  <span className="text-[9px] text-sub w-4 leading-none">{d}</span>
                ) : (
                  <span className="w-4" />
                )}
              </div>
            ))}
          </div>

          {/* 主体：月份标签 + 格子 */}
          <div className="flex flex-col" style={{ minWidth: 'max-content' }}>
            {/* 月份标签行 */}
            <div className="relative h-5 mb-1" style={{ width: `${totalCols * 17}px` }}>
              {monthLabels.map(({ col, label }) => (
                <span
                  key={col}
                  className="absolute text-[10px] text-sub"
                  style={{ left: `${col * 17}px` }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* 格子区域 */}
            <div className="flex gap-[3px]">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((cell, ri) => {
                    if (cell.count === -1) {
                      // 超出所选年范围 → 空白占位
                      return <div key={ri} className="w-[14px] h-[14px]" />;
                    }
                    if (cell.future) {
                      return <div key={ri} className="w-[14px] h-[14px] rounded-[3px]" style={{ backgroundColor: SCALE[0], opacity: 0.4 }} />;
                    }
                    return (
                      <div
                        key={ri}
                        className="w-[14px] h-[14px] rounded-[3px] cursor-default"
                        style={{ backgroundColor: tint(cell.count) }}
                        title={`${new Date(cell.date).toLocaleDateString('zh-CN')} · ${cell.count > 0 ? `${cell.count} 颗瓜` : '休息'}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-sub">
        <span>少</span>
        {SCALE.map((c) => (
          <span key={c} className="w-[14px] h-[14px] rounded-[3px] inline-block" style={{ backgroundColor: c }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
