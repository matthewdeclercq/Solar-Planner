/**
 * Solar table component
 */

import { getSolarTableBody } from '@services/domService';
import type { SolarMonthData } from '../../types/solar';

/**
 * Render table rows from data
 */
function renderTableRows<T>(
  tbody: HTMLTableSectionElement | null,
  data: T[],
  columns: ((row: T) => string | number)[]
): void {
  if (!tbody) return;

  tbody.innerHTML = data
    .map(
      (row) => `
    <tr>
      ${columns.map((col) => `<td>${col(row)}</td>`).join('')}
    </tr>
  `
    )
    .join('');
}

/**
 * Render the solar data table
 */
export function renderSolarTable(solar: SolarMonthData[]): void {
  const tbody = getSolarTableBody();
  renderTableRows(tbody, solar, [
    (row) => row.month,
    (row) => row.monthlyOptimal.tilt,
    (row) => row.monthlyOptimal.psh,
    (row) => row.yearlyFixed.tilt,
    (row) => row.yearlyFixed.psh,
    (row) => row.flat.psh,
  ]);
}
