/**
 * Chart configuration module
 * Shared chart options and utilities
 */

import { type ChartInstance } from '@utils/chartGlobal';
import { getCurrentTheme } from '@services/themeService';
import { createRgbaColor } from '@utils/index';
import type {
  ChartCommonOptions,
  YAxisConfig,
  YAxisPosition,
  LineDatasetOptions,
  ChartDataset,
} from '../../types/charts';

// Chart resize debouncing
let chartResizeTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Shared chart configuration options
 */
export const CHART_COMMON_OPTIONS: ChartCommonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 12,
        usePointStyle: true,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(21, 29, 39, 0.95)',
      titleColor: '#F0F4F8',
      bodyColor: '#8DA4BE',
      borderColor: 'rgba(141, 164, 190, 0.2)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
  },
};

/**
 * Create Y-axis configuration
 */
export function createYAxis(
  title: string,
  position: YAxisPosition = 'left',
  min?: number,
  max?: number
): YAxisConfig {
  const theme = getCurrentTheme();
  const gridColor = theme === 'light' ? 'rgba(120, 113, 108, 0.1)' : 'rgba(141, 164, 190, 0.1)';

  const config: YAxisConfig = {
    type: 'linear',
    display: true,
    position,
    title: { display: true, text: title },
    grid: position === 'left' ? { color: gridColor } : { drawOnChartArea: false },
  };

  if (min !== undefined) {
    config.min = min;
  }
  if (max !== undefined) {
    config.max = max;
  }

  return config;
}

/**
 * Create line dataset configuration
 */
export function createLineDataset(
  label: string,
  data: number[],
  color: string,
  options: LineDatasetOptions = {}
): ChartDataset {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: createRgbaColor(color, 0.1),
    borderWidth: options.borderWidth ?? 2,
    tension: 0.3,
    pointRadius: options.pointRadius ?? 4,
    pointHoverRadius: options.pointHoverRadius ?? 6,
    pointBackgroundColor: color,
    fill: options.fill ?? false,
    yAxisID: options.yAxisID,
    borderDash: options.borderDash,
  };
}

/**
 * Create bar dataset configuration
 */
export function createBarDataset(
  label: string,
  data: number[],
  color: string,
  yAxisID: string,
  order: number
): ChartDataset {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: createRgbaColor(color, 0.3),
    borderWidth: 0,
    type: 'bar',
    yAxisID,
    order,
  };
}

/**
 * Debounced chart resize helper
 */
export function debounceChartResize(chart: ChartInstance, delay: number = 100): void {
  if (chartResizeTimeout) {
    clearTimeout(chartResizeTimeout);
  }
  chartResizeTimeout = setTimeout(() => {
    if (chart) {
      chart.resize();
    }
    chartResizeTimeout = null;
  }, delay);
}

/**
 * Get theme-aware colors for solar/power gen charts
 */
export function getThemeColors(): {
  monthly: string;
  yearly: string;
  flat: string;
} {
  const theme = getCurrentTheme();
  return {
    monthly: theme === 'light' ? '#D97706' : '#F5A623',
    yearly: theme === 'light' ? '#0369A1' : '#0096C7',
    flat: theme === 'light' ? '#78716C' : '#8DA4BE',
  };
}
