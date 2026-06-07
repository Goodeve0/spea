import html2canvas from 'html2canvas';

/**
 * 将 DOM 元素截图为 PNG 并触发浏览器下载。
 */
export async function exportElementToPng(element: HTMLElement, filename: string): Promise<void> {
  element.scrollIntoView({ block: 'start' });

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#F5F7FA',
    useCORS: true,
    logging: false,
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
        return;
      }
      reject(new Error('Failed to create PNG blob'));
    }, 'image/png');
  });

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 生成本地时区报告 PNG 文件名，精确到分钟。 */
export function buildReportExportFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `spea-report-${y}-${mo}-${d}-${h}${mi}.png`;
}

const GROWTH_RENDERED_MIN_HEIGHT = 80;
const GROWTH_WAIT_MS = 2000;
const GROWTH_POLL_MS = 100;

/**
 * 导出前等待成长曲线 lazy 组件渲染（最多 2s）。
 */
export async function waitForGrowthCurveReady(
  container: HTMLElement | null,
  hasGrowthData: boolean,
): Promise<void> {
  if (!container || !hasGrowthData) return;

  const deadline = Date.now() + GROWTH_WAIT_MS;
  while (Date.now() < deadline) {
    const growthSection = container.querySelector('[data-growth-curve]');
    if (growthSection instanceof HTMLElement && growthSection.offsetHeight >= GROWTH_RENDERED_MIN_HEIGHT) {
      return;
    }
    await new Promise((r) => setTimeout(r, GROWTH_POLL_MS));
  }
}
