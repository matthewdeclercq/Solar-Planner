/**
 * Combined data response types
 */

import { WeatherData } from './weather';
import { SolarMonthData } from './solar';

export interface LocationDataResponse {
  location: string;
  latitude: number;
  longitude: number;
  weather: WeatherData[];
  solar: SolarMonthData[];
  yearsOfData: number;
  cached: boolean;
  cachedAt?: number;
}
