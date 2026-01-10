/**
 * Power generation types
 */

import type { SolarMonthData } from './solar';

export type PowerGenViewMode = 'daily' | 'monthly';

export type TiltMethod = 'monthlyOptimal' | 'yearlyFixed' | 'flat';

export interface DaylightHours {
  sunrise: number;
  sunset: number;
  daylightHours: number;
}

export interface PowerGenState {
  solarData: SolarMonthData[] | null;
  latitude: number | null;
  panelWatts: number | null;
  viewMode: PowerGenViewMode;
}

export interface PowerGenChartData {
  labels: string[];
  monthlyOptimalData: number[];
  yearlyFixedData: number[];
  flatData: number[];
}
