/**
 * Power generation table component
 */

import {
  getPowerGenTableBody,
  getPowerGenMonthlyOptimalTotal,
  getPowerGenYearlyFixedTotal,
  getPowerGenFlatTotal,
} from '@services/domService';
import { POWER_ROUNDING_DECIMALS } from '@services/configService';
import type { SolarMonthData } from '../../types/solar';

// Days in each month (non-leap year)
const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface PowerGenTableData {
  solar: SolarMonthData[];
  watts: number;
}

/**
 * Render power generation table
 */
export function renderPowerGenTable(data: PowerGenTableData): void {
  const { solar, watts } = data;
  const tbody = getPowerGenTableBody();

  if (!tbody || !watts) {
    return;
  }

  let monthlyOptimalTotal = 0;
  let yearlyFixedTotal = 0;
  let flatTotal = 0;

  const rows = solar.map((row, index) => {
    // Calculate daily power (kWh) = PSH * watts / 1000
    const monthlyOptimalDaily = ((row.monthlyOptimal.psh * watts) / 1000).toFixed(
      POWER_ROUNDING_DECIMALS
    );
    const yearlyFixedDaily = ((row.yearlyFixed.psh * watts) / 1000).toFixed(
      POWER_ROUNDING_DECIMALS
    );
    const flatDaily = ((row.flat.psh * watts) / 1000).toFixed(POWER_ROUNDING_DECIMALS);

    // Calculate monthly power = daily * days in month
    const daysInMonth = DAYS_IN_MONTHS[index];
    const monthlyOptimalMonthly = (parseFloat(monthlyOptimalDaily) * daysInMonth).toFixed(
      POWER_ROUNDING_DECIMALS
    );
    const yearlyFixedMonthly = (parseFloat(yearlyFixedDaily) * daysInMonth).toFixed(
      POWER_ROUNDING_DECIMALS
    );
    const flatMonthly = (parseFloat(flatDaily) * daysInMonth).toFixed(POWER_ROUNDING_DECIMALS);

    // Update annual totals
    monthlyOptimalTotal += parseFloat(monthlyOptimalMonthly);
    yearlyFixedTotal += parseFloat(yearlyFixedMonthly);
    flatTotal += parseFloat(flatMonthly);

    return `
      <tr>
        <td>${row.month}</td>
        <td>${monthlyOptimalDaily}</td>
        <td>${monthlyOptimalMonthly}</td>
        <td>${yearlyFixedDaily}</td>
        <td>${yearlyFixedMonthly}</td>
        <td>${flatDaily}</td>
        <td>${flatMonthly}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');

  // Update footer totals (annual total)
  const monthlyOptimalTotalEl = getPowerGenMonthlyOptimalTotal();
  const yearlyFixedTotalEl = getPowerGenYearlyFixedTotal();
  const flatTotalEl = getPowerGenFlatTotal();

  if (monthlyOptimalTotalEl) {
    monthlyOptimalTotalEl.textContent = `${monthlyOptimalTotal.toFixed(POWER_ROUNDING_DECIMALS)} kWh`;
  }
  if (yearlyFixedTotalEl) {
    yearlyFixedTotalEl.textContent = `${yearlyFixedTotal.toFixed(POWER_ROUNDING_DECIMALS)} kWh`;
  }
  if (flatTotalEl) {
    flatTotalEl.textContent = `${flatTotal.toFixed(POWER_ROUNDING_DECIMALS)} kWh`;
  }
}
