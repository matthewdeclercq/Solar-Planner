/**
 * Table rendering module
 */

import {
  weatherTableBody,
  solarTableBody,
  powerGenTableBody,
  powerGenMonthlyOptimalTotal,
  powerGenYearlyFixedTotal,
  powerGenFlatTotal
} from './dom.js';

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

/**
 * Render power generation table
 * @param {Array} solar - Solar data with PSH values
 * @param {number} watts - Panel wattage
 */
export function renderPowerGenTable(solar, watts) {
  if (!powerGenTableBody || !watts) {
    return;
  }

  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let monthlyOptimalTotal = 0;
  let yearlyFixedTotal = 0;
  let flatTotal = 0;

  const rows = solar.map((row, index) => {
    // Calculate daily power (kWh) = PSH * watts / 1000
    const monthlyOptimalDaily = (row.monthlyOptimal.psh * watts / 1000).toFixed(2);
    const yearlyFixedDaily = (row.yearlyFixed.psh * watts / 1000).toFixed(2);
    const flatDaily = (row.flat.psh * watts / 1000).toFixed(2);

    // Calculate monthly power = daily * days in month
    const daysInMonth = daysInMonths[index];
    const monthlyOptimalMonthly = (monthlyOptimalDaily * daysInMonth).toFixed(2);
    const yearlyFixedMonthly = (yearlyFixedDaily * daysInMonth).toFixed(2);
    const flatMonthly = (flatDaily * daysInMonth).toFixed(2);

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

  powerGenTableBody.innerHTML = rows.join('');

  // Update footer totals (annual total)
  if (powerGenMonthlyOptimalTotal) {
    powerGenMonthlyOptimalTotal.textContent = `${monthlyOptimalTotal.toFixed(2)} kWh`;
  }
  if (powerGenYearlyFixedTotal) {
    powerGenYearlyFixedTotal.textContent = `${yearlyFixedTotal.toFixed(2)} kWh`;
  }
  if (powerGenFlatTotal) {
    powerGenFlatTotal.textContent = `${flatTotal.toFixed(2)} kWh`;
  }
}
