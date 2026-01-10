/**
 * Weather service
 * Handles Visual Crossing API integration and weather data processing
 */

import type { VisualCrossingDay, VisualCrossingResponse, WeatherData } from '../types';
import { avg, round } from '../utils/math';
import { enhanceResolvedAddress } from './geocoding';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEFAULT_YEARS_OF_DATA = 2;

export function buildWeatherApiUrl(apiLocation: string, startStr: string, endStr: string, apiKey: string): string {
  const params = new URLSearchParams({
    unitGroup: 'us',
    include: 'days',
    key: apiKey,
    elements: 'datetime,tempmax,tempmin,temp,humidity,solarenergy'
  });

  return `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(apiLocation)}/${startStr}/${endStr}?${params}`;
}

export function processWeatherData(days: VisualCrossingDay[]): WeatherData[] {
  const weather: WeatherData[] = [];

  // Pre-group days by month
  const daysByMonth = Array.from({ length: 12 }, () => [] as VisualCrossingDay[]);
  for (const day of days) {
    const month = new Date(day.datetime).getMonth();
    if (month >= 0 && month < 12) {
      daysByMonth[month].push(day);
    }
  }

  // Calculate monthly averages
  for (let m = 0; m < 12; m++) {
    const monthDays = daysByMonth[m];
    weather.push({
      month: MONTHS[m],
      highF: round(avg(monthDays, 'tempmax'), 1),
      lowF: round(avg(monthDays, 'tempmin'), 1),
      meanF: round(avg(monthDays, 'temp'), 1),
      humidity: round(avg(monthDays, 'humidity'), 1)
    });
  }

  return weather;
}

export async function fetchWeatherData(
  apiLocation: string,
  apiKey: string,
  years: number = DEFAULT_YEARS_OF_DATA
): Promise<{ data: VisualCrossingResponse; resolvedAddress: string }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - years);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const apiUrl = buildWeatherApiUrl(apiLocation, startStr, endStr, apiKey);
  const response = await fetch(apiUrl);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
    throw new Error('Could not fetch weather data for this location');
  }

  const data = await response.json() as VisualCrossingResponse;

  if (!data.days || data.days.length === 0) {
    throw new Error('No weather data available for this location');
  }

  if (data.latitude == null || data.longitude == null || isNaN(data.latitude) || isNaN(data.longitude)) {
    throw new Error('Invalid location coordinates received from API');
  }

  // Enhance resolved address with reverse geocoding if needed
  const resolvedAddress = await enhanceResolvedAddress(
    data.resolvedAddress,
    data.latitude,
    data.longitude
  );

  return { data, resolvedAddress };
}
