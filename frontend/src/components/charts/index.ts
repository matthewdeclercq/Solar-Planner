/**
 * Charts module index
 * Aggregates all chart exports
 */

// Re-export chart configuration
export {
  CHART_COMMON_OPTIONS,
  createYAxis,
  createLineDataset,
  createBarDataset,
  debounceChartResize,
  getThemeColors,
} from './chartConfig';

// Re-export weather chart
export {
  renderWeatherChart,
  updateWeatherChartTheme,
  getWeatherChart,
  destroyWeatherChart,
} from './weatherChart';

// Re-export solar charts
export {
  renderSolarChart,
  renderSolarTiltChart,
  updateSolarChartsTheme,
  getSolarChart,
  getSolarTiltChart,
  destroySolarCharts,
} from './solarCharts';
