/**
 * Chart utility functions
 */

import { getChart, type ChartInstance } from '@utils/chartGlobal';
import { getCurrentTheme } from '@services/themeService';

/**
 * Update Chart.js defaults based on current theme
 */
export function updateChartDefaults(): void {
  const theme = getCurrentTheme();
  const Chart = getChart();
  Chart.defaults.font.family =
    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  if (theme === 'light') {
    Chart.defaults.color = '#57534E';
    Chart.defaults.borderColor = 'rgba(120, 113, 108, 0.15)';
  } else {
    Chart.defaults.color = '#8DA4BE';
    Chart.defaults.borderColor = 'rgba(141, 164, 190, 0.15)';
  }
}

/**
 * Safely destroy a chart instance
 */
export function safeDestroyChart(chart: ChartInstance): null {
  if (chart) {
    chart.destroy();
  }
  return null;
}
