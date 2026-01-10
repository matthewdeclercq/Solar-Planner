/**
 * Chart.js setup
 * Provides access to Chart.js imported as npm package
 */

import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';
import type { ChartTypeRegistry } from 'chart.js';

// Register required Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  Filler
);

/**
 * Get the Chart constructor
 */
export function getChart(): typeof Chart {
  return Chart;
}

// Chart instance type - flexible type that works with any chart type
// Using Chart with generic parameters that match common usage patterns
export type ChartInstance = Chart<
  keyof ChartTypeRegistry,
  (number | [number, number] | null)[],
  string
> | null;
