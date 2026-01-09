/**
 * Shared chart utility functions
 * Extracted to eliminate duplication between charts.js and powergen.js
 */

import { getCurrentTheme } from './theme.js';

/**
 * Update Chart.js defaults based on current theme
 */
export function updateChartDefaults() {
  const theme = getCurrentTheme();
  Chart.defaults.font.family = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
 * @param {Chart|null} chart - Chart instance to destroy
 * @returns {null}
 */
export function safeDestroyChart(chart) {
  if (chart) {
    chart.destroy();
  }
  return null;
}
