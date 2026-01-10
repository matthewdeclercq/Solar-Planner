/**
 * Solar data types
 */

export interface SolarTiltData {
  tilt: string;
  psh: number;
}

export interface SolarMonthData {
  month: string;
  monthlyOptimal: SolarTiltData;
  yearlyFixed: SolarTiltData;
  flat: SolarTiltData;
}
