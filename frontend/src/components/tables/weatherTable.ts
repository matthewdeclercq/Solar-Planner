/**
 * Weather table component
 */

import { getWeatherTableBody } from '@services/domService';
import type { WeatherData } from '../../types/weather';

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
 * Render the weather data table
 */
export function renderWeatherTable(weather: WeatherData[]): void {
  const tbody = getWeatherTableBody();
  renderTableRows(tbody, weather, [
    (row) => row.month,
    (row) => row.highF,
    (row) => row.lowF,
    (row) => row.meanF,
    (row) => row.humidity,
  ]);
}
