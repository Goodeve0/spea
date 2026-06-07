import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

import html2canvas from 'html2canvas';

import {
  buildReportExportFilename,
  exportElementToPng,
  waitForGrowthCurveReady,
} from './export-report-png';

describe('buildReportExportFilename', () => {
  it('formats local date as spea-report-YYYY-MM-DD-HHmm.png', () => {
    const name = buildReportExportFilename(new Date(2026, 5, 5, 14, 7));
    expect(name).toBe('spea-report-2026-06-05-1407.png');
  });
});

describe('exportElementToPng', () => {
  const mockHtml2canvas = vi.mocked(html2canvas);
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    mockHtml2canvas.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls html2canvas on element and triggers download with filename', async () => {
    const element = document.createElement('div');
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;

    const canvas = {
      toBlob: (cb: (blob: Blob | null) => void) => {
        cb(new Blob(['png'], { type: 'image/png' }));
      },
    };
    mockHtml2canvas.mockResolvedValue(canvas as unknown as HTMLCanvasElement);

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportElementToPng(element, 'spea-report-2026-06-05-1407.png');

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(mockHtml2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        scale: 2,
        backgroundColor: '#F5F7FA',
        useCORS: true,
        logging: false,
      }),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rejects when canvas.toBlob returns null', async () => {
    const element = document.createElement('div');
    element.scrollIntoView = vi.fn();

    const canvas = {
      toBlob: (cb: (blob: Blob | null) => void) => {
        cb(null);
      },
    };
    mockHtml2canvas.mockResolvedValue(canvas as unknown as HTMLCanvasElement);

    await expect(exportElementToPng(element, 'test.png')).rejects.toThrow('Failed to create PNG blob');
  });
});

describe('waitForGrowthCurveReady', () => {
  it('returns immediately when no growth data', async () => {
    const container = document.createElement('div');
    await expect(waitForGrowthCurveReady(container, false)).resolves.toBeUndefined();
  });

  it('returns when growth section is tall enough', async () => {
    const container = document.createElement('div');
    const growth = document.createElement('div');
    growth.setAttribute('data-growth-curve', '');
    Object.defineProperty(growth, 'offsetHeight', { value: 120, configurable: true });
    container.appendChild(growth);

    await expect(waitForGrowthCurveReady(container, true)).resolves.toBeUndefined();
  });
});
