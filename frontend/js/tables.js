/**
 * Table rendering module
 */

import { weatherTableBody, solarTableBody } from './dom.js';

/**
 * Render table rows from data
 * @param {HTMLElement} tbody - Table body element
 * @param {Array} data - Data array
 * @param {Array<Function>} columns - Column renderer functions
 */
function renderTable(tbody, data, columns) {
  tbody.innerHTML = data.map(row => `
    <tr>
      ${columns.map(col => `<td>${col(row)}</td>`).join('')}
    </tr>
  `).join('');
}

/**
 * Render the weather data table
 * @param {Array} weather - Weather data array
 */
export function renderWeatherTable(weather) {
  renderTable(weatherTableBody, weather, [
    row => row.month,
    row => row.highF,
    row => row.lowF,
    row => row.meanF,
    row => row.humidity
  ]);
}

/**
 * Render the solar data table
 * @param {Array} solar - Solar data array
 */
export function renderSolarTable(solar) {
  renderTable(solarTableBody, solar, [
    row => row.month,
    row => row.monthlyOptimal.tilt,
    row => row.monthlyOptimal.psh,
    row => row.yearlyFixed.tilt,
    row => row.yearlyFixed.psh,
    row => row.flat.psh
  ]);
}

