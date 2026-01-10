/**
 * Solar charts component
 * Handles PSH chart and Tilt angle chart
 */

import { getChart, type ChartInstance } from '@utils/chartGlobal';
import { getSolarChartEl, getSolarTiltChartEl } from '@services/domService';
import { getCurrentTheme } from '@services/themeService';
import { Y_AXIS_PADDING_FACTOR } from '@services/configService';
import { updateChartDefaults, safeDestroyChart } from '@utils/chartUtils';
import {
  CHART_COMMON_OPTIONS,
  createYAxis,
  createLineDataset,
  getThemeColors,
} from './chartConfig';
import type { SolarMonthData } from '../../types/solar';

// Chart instances
let solarChart: ChartInstance = null;
let solarTiltChart: ChartInstance = null;

// Store data for theme re-rendering
let storedSolarData: SolarMonthData[] | null = null;

/**
 * Parse tilt angle from string like "45° N" or "30° S"
 * Returns negative values for North, positive for South
 */
function parseTiltAngle(tiltString: string): number {
  if (!tiltString || typeof tiltString !== 'string') return 0;
  const match = tiltString.match(/(\d+)\s*°\s*([NS])?/i);
  if (!match) return 0;

  const angle = parseInt(match[1], 10);
  if (isNaN(angle)) return 0;

  const direction = match[2]?.toUpperCase();

  // North-facing tilts are negative, South-facing are positive
  if (direction === 'N') {
    return -angle;
  } else if (direction === 'S') {
    return angle;
  }

  // If no direction specified, assume it's the absolute value (likely 0°)
  return angle;
}

/**
 * Render the solar PSH chart
 */
export function renderSolarChart(solar: SolarMonthData[]): void {
  const canvas = getSolarChartEl();
  if (!canvas) return;

  // Store data for theme updates
  storedSolarData = solar;

  // Update Chart.js defaults based on current theme
  updateChartDefaults();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  solarChart = safeDestroyChart(solarChart);

  // Extract all data in a single pass using reduce
  const chartData = solar.reduce(
    (acc, s) => {
      acc.labels.push(s.month);
      acc.monthlyOptimalPsh.push(s.monthlyOptimal.psh);
      acc.yearlyFixedPsh.push(s.yearlyFixed.psh);
      acc.flatPsh.push(s.flat.psh);
      return acc;
    },
    {
      labels: [] as string[],
      monthlyOptimalPsh: [] as number[],
      yearlyFixedPsh: [] as number[],
      flatPsh: [] as number[],
    }
  );

  const { labels, monthlyOptimalPsh, yearlyFixedPsh, flatPsh } = chartData;

  // Get the yearly fixed tilt value (same for all months)
  const yearlyFixedTilt = solar[0]?.yearlyFixed?.tilt || '';

  // Calculate dynamic Y-axis bounds based on data range
  const allPsh = [...monthlyOptimalPsh, ...yearlyFixedPsh, ...flatPsh];
  const minPsh = Math.min(...allPsh);
  const maxPsh = Math.max(...allPsh);

  // Add padding and round to nearest 0.5 for clean axis labels
  const yAxisMin = Math.floor(minPsh * 0.9 * 2) / 2;
  const yAxisMax = Math.ceil(maxPsh * 1.1 * 2) / 2;

  // Get theme-aware colors
  const colors = getThemeColors();

  const Chart = getChart();
  solarChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('Monthly Optimal Tilt', monthlyOptimalPsh, colors.monthly, {
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
        }),
        createLineDataset(
          `Yearly Fixed Tilt (${yearlyFixedTilt})`,
          yearlyFixedPsh,
          colors.yearly
        ),
        createLineDataset('Flat (0°)', flatPsh, colors.flat, {
          borderDash: [5, 5],
        }),
      ],
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${context.parsed.y} kWh/m²/day`,
          },
        },
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis('Peak Sun Hours (kWh/m²/day)', 'left', yAxisMin, yAxisMax),
      },
    },
  });
}

/**
 * Render the solar tilt angle chart
 */
export function renderSolarTiltChart(solar: SolarMonthData[]): void {
  const canvas = getSolarTiltChartEl();
  if (!canvas) return;

  // Store data for theme updates
  storedSolarData = solar;

  // Update Chart.js defaults based on current theme
  updateChartDefaults();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  solarTiltChart = safeDestroyChart(solarTiltChart);

  // Extract and parse all data
  const labels = solar.map((s) => s.month);
  const monthlyOptimalTilt = solar.map((s) => parseTiltAngle(s.monthlyOptimal.tilt));
  const yearlyFixedTilt = solar.map((s) => parseTiltAngle(s.yearlyFixed.tilt));

  // Get the yearly fixed tilt value for label (same for all months)
  const yearlyFixedTiltLabel = solar[0]?.yearlyFixed?.tilt || '';

  // Find the range of tilt angles to set appropriate Y-axis bounds
  const allTilts = [...monthlyOptimalTilt, ...yearlyFixedTilt];
  const maxAbsTilt = allTilts.length > 0 ? Math.max(...allTilts.map(Math.abs)) : 90;
  const yAxisMax = Math.ceil(maxAbsTilt * Y_AXIS_PADDING_FACTOR);
  const yAxisMin = -yAxisMax;

  // Get theme-aware colors
  const colors = getThemeColors();

  const Chart = getChart();
  solarTiltChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('Monthly Optimal Tilt', monthlyOptimalTilt, colors.monthly, {
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
        }),
        createLineDataset(
          `Yearly Fixed Tilt (${yearlyFixedTiltLabel})`,
          yearlyFixedTilt,
          colors.yearly,
          {
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          }
        ),
      ],
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context: any) => {
              const tiltValue = context.parsed.y;
              const absValue = Math.abs(tiltValue);
              const direction = tiltValue < 0 ? 'N' : tiltValue > 0 ? 'S' : '';
              return `${context.dataset.label}: ${absValue}°${direction ? ' ' + direction : ''}`;
            },
          },
        },
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Tilt Angle (degrees)' },
          min: yAxisMin,
          max: yAxisMax,
          ticks: {
            callback: function (value: number | string) {
              const numValue = typeof value === 'string' ? parseFloat(value) : value;
              const absValue = Math.abs(numValue);
              const direction = numValue < 0 ? 'N' : numValue > 0 ? 'S' : '';
              return absValue + '°' + (direction ? ' ' + direction : '');
            },
          },
          grid: {
            color: function (context: any) {
              const currentTheme = getCurrentTheme();
              const baseColor =
                currentTheme === 'light' ? 'rgba(120, 113, 108, 0.1)' : 'rgba(141, 164, 190, 0.1)';
              const highlightColor =
                currentTheme === 'light' ? 'rgba(120, 113, 108, 0.4)' : 'rgba(141, 164, 190, 0.4)';

              // Highlight the 0° line
              if (context.tick && context.tick.value === 0) {
                return highlightColor;
              }
              return baseColor;
            },
            lineWidth: function (context: any) {
              // Make the 0° line thicker
              if (context.tick && context.tick.value === 0) {
                return 2;
              }
              return 1;
            },
          },
        },
      },
    },
  });
}

/**
 * Update solar charts theme
 */
export function updateSolarChartsTheme(): void {
  if (storedSolarData) {
    if (solarChart) {
      renderSolarChart(storedSolarData);
    }
    if (solarTiltChart) {
      renderSolarTiltChart(storedSolarData);
    }
  }
}

/**
 * Get solar PSH chart instance
 */
export function getSolarChart(): ChartInstance {
  return solarChart;
}

/**
 * Get solar tilt chart instance
 */
export function getSolarTiltChart(): ChartInstance {
  return solarTiltChart;
}

/**
 * Destroy all solar charts
 */
export function destroySolarCharts(): void {
  solarChart = safeDestroyChart(solarChart);
  solarTiltChart = safeDestroyChart(solarTiltChart);
  storedSolarData = null;
}
