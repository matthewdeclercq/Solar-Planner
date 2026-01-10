/**
 * Weather chart component
 */

import { getChart, type ChartInstance } from '@utils/chartGlobal';
import { getWeatherChartEl } from '@services/domService';
import { updateChartDefaults, safeDestroyChart } from '@utils/chartUtils';
import {
  CHART_COMMON_OPTIONS,
  createYAxis,
  createLineDataset,
  createBarDataset,
} from './chartConfig';
import type { WeatherData } from '../../types/weather';

// Chart instance
let weatherChart: ChartInstance = null;

// Store data for theme re-rendering
let storedWeatherData: WeatherData[] | null = null;

/**
 * Render the weather chart
 */
export function renderWeatherChart(weather: WeatherData[]): void {
  const canvas = getWeatherChartEl();
  if (!canvas) return;

  // Store data for theme updates
  storedWeatherData = weather;

  // Update Chart.js defaults based on current theme
  updateChartDefaults();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  weatherChart = safeDestroyChart(weatherChart);

  // Extract data arrays
  const labels = weather.map((w) => w.month);
  const highF = weather.map((w) => w.highF);
  const meanF = weather.map((w) => w.meanF);
  const lowF = weather.map((w) => w.lowF);
  const humidity = weather.map((w) => w.humidity);

  const Chart = getChart();
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('High (°F)', highF, '#DC2F02', { yAxisID: 'y' }),
        createLineDataset('Mean (°F)', meanF, '#F5A623', { yAxisID: 'y' }),
        createLineDataset('Low (°F)', lowF, '#0096C7', { yAxisID: 'y' }),
        createBarDataset('Humidity (%)', humidity, '#10B981', 'y1', 2),
      ],
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis('Temperature (°F)'),
        y1: { ...createYAxis('Humidity (%)', 'right', 0, 100), display: true },
      },
    },
  });
}

/**
 * Update weather chart theme
 */
export function updateWeatherChartTheme(): void {
  if (storedWeatherData && weatherChart) {
    renderWeatherChart(storedWeatherData);
  }
}

/**
 * Get weather chart instance
 */
export function getWeatherChart(): ChartInstance {
  return weatherChart;
}

/**
 * Destroy weather chart
 */
export function destroyWeatherChart(): void {
  weatherChart = safeDestroyChart(weatherChart);
  storedWeatherData = null;
}
