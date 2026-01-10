/**
 * Chart-related types
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartType = any;

export interface ChartInstances {
  weather: ChartType | null;
  solar: ChartType | null;
  solarTilt: ChartType | null;
  powerGen: ChartType | null;
  hourlyPower: ChartType | null;
}

export interface ChartConfig {
  type: 'line' | 'bar';
  data: {
    labels: string[];
    datasets: unknown[];
  };
  options: unknown;
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  borderWidth?: number;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  pointBackgroundColor?: string;
  fill?: boolean;
  yAxisID?: string;
  type?: 'line' | 'bar';
  order?: number;
  borderDash?: number[];
}

export interface LineDatasetOptions {
  borderWidth?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  fill?: boolean;
  yAxisID?: string;
  borderDash?: number[];
}

export type YAxisPosition = 'left' | 'right';

export interface YAxisConfig {
  type: 'linear';
  display: boolean;
  position: YAxisPosition;
  title: { display: boolean; text: string };
  min?: number;
  max?: number;
  grid: {
    color?: string | ((context: { tick?: { value: number } }) => string);
    drawOnChartArea?: boolean;
    lineWidth?: number | ((context: { tick?: { value: number } }) => number);
  };
  ticks?: {
    callback?: (value: number | string) => string;
  };
}

export interface ChartCommonOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  interaction: {
    mode: 'index';
    intersect: boolean;
  };
  plugins: {
    legend: {
      position: 'top';
      labels: {
        boxWidth: number;
        usePointStyle: boolean;
        padding: number;
      };
    };
    tooltip: {
      backgroundColor: string;
      titleColor: string;
      bodyColor: string;
      borderColor: string;
      borderWidth: number;
      padding: number;
      cornerRadius: number;
    };
  };
  scales: {
    x: {
      grid: {
        display: boolean;
      };
    };
    y?: YAxisConfig;
    y1?: YAxisConfig;
  };
}
