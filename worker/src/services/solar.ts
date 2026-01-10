/**
 * Solar calculation service
 * Handles solar tilt calculations and PSH processing
 */

import type { VisualCrossingDay, SolarMonthData } from '../types';
import { avg, round } from '../utils/math';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Solar declination by month (degrees) - positive when sun is north of equator
const SOLAR_DECLINATIONS = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

// Conversion constants
const MJ_TO_KWH = 3.6; // 1 kWh = 3.6 MJ

// Latitude bands for solar gain calculations
const LATITUDE_BANDS = {
  EQUATORIAL: { max: 20, minGain: 1.03, maxGain: 1.15 },
  MID_LATITUDE: { max: 45, minGain: 1.05, maxGain: 1.40 },
  HIGH_LATITUDE: { max: 60, minGain: 1.15, maxGain: 1.80 },
  POLAR: { max: 90, minGain: 1.20, maxGain: 2.20 }
};

// Solar tilt calculation constants
const TILT_PENALTY_EXPONENT = 1.5;

export function calculateMonthlyOptimalTilt(latitude: number, month: number): { tilt: number; direction: string } {
  const declination = SOLAR_DECLINATIONS[month - 1];

  // The sun's position relative to the location determines optimal direction
  const sunPosition = declination;
  const sunIsNorthOfLocation = sunPosition > latitude;

  // Optimal direction: face toward the sun
  const direction = sunIsNorthOfLocation ? 'N' : 'S';

  // Optimal tilt calculation: |latitude - declination| when facing toward the sun
  let optimalTilt = Math.abs(latitude - declination);
  optimalTilt = Math.max(0, Math.min(90, Math.round(optimalTilt)));

  return { tilt: optimalTilt, direction };
}

function getLatitudeGainRange(latitude: number): { minGain: number; maxGain: number } {
  const absLat = Math.abs(latitude);

  if (absLat < LATITUDE_BANDS.EQUATORIAL.max) {
    return {
      minGain: LATITUDE_BANDS.EQUATORIAL.minGain,
      maxGain: LATITUDE_BANDS.EQUATORIAL.maxGain
    };
  } else if (absLat < LATITUDE_BANDS.MID_LATITUDE.max) {
    return {
      minGain: LATITUDE_BANDS.MID_LATITUDE.minGain,
      maxGain: LATITUDE_BANDS.MID_LATITUDE.maxGain
    };
  } else if (absLat < LATITUDE_BANDS.HIGH_LATITUDE.max) {
    return {
      minGain: LATITUDE_BANDS.HIGH_LATITUDE.minGain,
      maxGain: LATITUDE_BANDS.HIGH_LATITUDE.maxGain
    };
  } else {
    return {
      minGain: LATITUDE_BANDS.POLAR.minGain,
      maxGain: LATITUDE_BANDS.POLAR.maxGain
    };
  }
}

function calculateMaxTiltGain(latitude: number, month: number): number {
  const declination = SOLAR_DECLINATIONS[month - 1];
  const optimalTilt = Math.abs(latitude - declination);
  const noonElevation = 90 - optimalTilt;
  const elevationFactor = 1 - (noonElevation / 90);

  const { minGain, maxGain } = getLatitudeGainRange(latitude);
  const gainRange = maxGain - minGain;
  const gain = minGain + (gainRange * elevationFactor);

  return Math.max(minGain, Math.min(maxGain, gain));
}

function calculateTiltGain(latitude: number, tiltAngle: number, month: number): number {
  if (tiltAngle === 0) return 1.0;

  const declination = SOLAR_DECLINATIONS[month - 1];
  const optimalTiltForMonth = Math.abs(latitude - declination);
  const maxGain = calculateMaxTiltGain(latitude, month);
  const tiltDifference = Math.abs(tiltAngle - optimalTiltForMonth);
  const tiltDiffRad = (tiltDifference * Math.PI) / 180;
  const tiltEfficiency = Math.pow(Math.cos(tiltDiffRad), TILT_PENALTY_EXPONENT);
  const gain = 1.0 + (maxGain - 1.0) * tiltEfficiency;

  return Math.max(1.0, Math.min(maxGain, gain));
}

export function processSolarData(days: VisualCrossingDay[], latitude: number): SolarMonthData[] {
  const solar: SolarMonthData[] = [];
  const fixedTilt = Math.round(Math.abs(latitude));
  const yearlyDirection = latitude >= 0 ? 'S' : 'N';

  // Pre-group days by month
  const daysByMonth = Array.from({ length: 12 }, () => [] as VisualCrossingDay[]);
  for (const day of days) {
    const month = new Date(day.datetime).getMonth();
    if (month >= 0 && month < 12) {
      daysByMonth[month].push(day);
    }
  }

  // Calculate monthly solar data
  for (let m = 0; m < 12; m++) {
    const monthDays = daysByMonth[m];
    const solarEnergyMJ = avg(monthDays, 'solarenergy');
    const flatPSH = solarEnergyMJ / MJ_TO_KWH;

    const monthNum = m + 1;
    const { tilt: monthlyTilt, direction: monthlyDirection } = calculateMonthlyOptimalTilt(latitude, monthNum);
    const monthlyTiltGain = calculateMaxTiltGain(latitude, monthNum);
    const fixedTiltGain = calculateTiltGain(latitude, fixedTilt, monthNum);

    const monthlyPSH = flatPSH * monthlyTiltGain;
    const fixedPSH = flatPSH * Math.min(fixedTiltGain, monthlyTiltGain);

    solar.push({
      month: MONTHS[m],
      monthlyOptimal: {
        tilt: `${monthlyTilt}° ${monthlyDirection}`,
        psh: round(monthlyPSH, 2)
      },
      yearlyFixed: {
        tilt: `${fixedTilt}° ${yearlyDirection}`,
        psh: round(fixedPSH, 2)
      },
      flat: {
        tilt: '0°',
        psh: round(flatPSH, 2)
      }
    });
  }

  return solar;
}
