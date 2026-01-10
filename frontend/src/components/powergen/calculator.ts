/**
 * Power generation calculator functions
 * Pure calculation functions with no DOM/Chart dependencies
 */

import type { SolarMonthData } from '../../types/solar';
import type { DaylightHours, TiltMethod } from '../../types/powergen';

// Month names for display
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Approximate day of year for middle of each month (for daylight calculations)
const MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

// Days in each month (non-leap year)
const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Calculate daily power generation in kWh
 */
export function calculateDailyPower(psh: number, panelWatts: number): number {
  return psh * (panelWatts / 1000);
}

/**
 * Get number of days in each month
 */
export function getDaysInMonths(): number[] {
  return [...DAYS_IN_MONTHS];
}

/**
 * Get PSH value based on selected tilt method
 */
export function getPshForMethod(solarMonth: SolarMonthData, tiltMethod: TiltMethod): number {
  switch (tiltMethod) {
    case 'monthlyOptimal':
      return solarMonth.monthlyOptimal.psh;
    case 'yearlyFixed':
      return solarMonth.yearlyFixed.psh;
    case 'flat':
      return solarMonth.flat.psh;
    default:
      return solarMonth.monthlyOptimal.psh;
  }
}

/**
 * Calculate approximate daylight hours for a given day of year and latitude
 * Uses the astronomical formula for day length
 */
export function calculateDaylightHours(dayOfYear: number, latitude: number): DaylightHours {
  // Solar declination (approximate)
  const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const declinationRad = (declination * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declinationRad);

  // Handle polar day/night
  if (cosHourAngle < -1) {
    // Polar day - 24 hours of sunlight
    return { sunrise: 0, sunset: 24, daylightHours: 24 };
  } else if (cosHourAngle > 1) {
    // Polar night - 0 hours of sunlight
    return { sunrise: 12, sunset: 12, daylightHours: 0 };
  }

  const hourAngle = (Math.acos(cosHourAngle) * 180) / Math.PI;
  const daylightHours = (2 * hourAngle) / 15; // Convert degrees to hours

  // Calculate sunrise and sunset times (solar time, centered on noon)
  const sunrise = 12 - daylightHours / 2;
  const sunset = 12 + daylightHours / 2;

  return { sunrise, sunset, daylightHours };
}

/**
 * Generate hourly power profile using sinusoidal solar radiation model
 */
export function generateHourlyProfile(
  dailyPower: number,
  monthIndex: number,
  latitude: number
): number[] {
  const dayOfYear = MID_MONTH_DOY[monthIndex];
  const { sunrise, sunset, daylightHours } = calculateDaylightHours(dayOfYear, latitude);

  if (daylightHours === 0) {
    return new Array(24).fill(0);
  }

  const hourlyValues: number[] = [];
  let totalArea = 0;

  // First pass: calculate raw sinusoidal values
  const rawValues: number[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourMid = hour + 0.5; // Middle of each hour

    if (hourMid < sunrise || hourMid > sunset) {
      rawValues.push(0);
    } else {
      // Sinusoidal distribution: sin(π * progress)
      const progress = (hourMid - sunrise) / daylightHours;
      const value = Math.sin(Math.PI * progress);
      rawValues.push(Math.max(0, value));
      totalArea += value;
    }
  }

  // Second pass: scale to match daily total
  const scaleFactor = totalArea > 0 ? dailyPower / totalArea : 0;
  for (let hour = 0; hour < 24; hour++) {
    hourlyValues.push(Math.round(rawValues[hour] * scaleFactor * 1000) / 1000);
  }

  return hourlyValues;
}

/**
 * Extract month index from chart title text
 */
export function extractMonthIndexFromTitle(titleElement: HTMLElement | null): number {
  if (!titleElement) return -1;

  const titleText = titleElement.textContent || '';
  const monthMatch = titleText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)/
  );

  if (monthMatch) {
    return MONTH_FULL.indexOf(monthMatch[1]);
  }

  return -1;
}
