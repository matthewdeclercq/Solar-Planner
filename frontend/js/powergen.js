/**
 * Power Generation Calculator Module
 * Calculates and visualizes solar power generation based on PSH data
 */

import {
  powerGenChartEl,
  powerGenLabel,
  powerGenPlaceholder,
  powerGenContainer,
  hourlyPowerChartEl,
  hourlyPowerContainer,
  hourlyBackBtn,
  hourlyChartTitle,
  panelWattageInput,
  querySelector
} from './dom.js';
import { CHART_COMMON_OPTIONS, createYAxis } from './charts.js';
import { getCurrentTheme } from './theme.js';
import { updateChartDefaults, safeDestroyChart } from './chart-utils.js';
import { POWER_ROUNDING_DECIMALS } from './config.js';
import { renderPowerGenTable } from './tables.js';

// Chart instances
let powerGenChart = null;
let hourlyPowerChart = null;

// Store current data for recalculations
let currentSolarData = null;
let currentLatitude = null;
let currentPanelWatts = null;

// View mode state: 'daily' or 'monthly'
let currentViewMode = 'daily';

// Month names for display
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Approximate day of year for middle of each month (for daylight calculations)
const MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

/**
 * Extract month index from chart title text
 * @param {HTMLElement} titleElement - Title element to parse
 * @returns {number} Month index (0-11) or -1 if not found
 */
function extractMonthIndexFromTitle(titleElement) {
  if (!titleElement) return -1;

  const titleText = titleElement.textContent;
  const monthMatch = titleText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/);

  if (monthMatch) {
    return MONTH_FULL.indexOf(monthMatch[1]);
  }

  return -1;
}

/**
 * Calculate daily power generation in kWh
 * @param {number} psh - Peak Sun Hours (kWh/m²/day)
 * @param {number} panelWatts - Panel wattage in watts
 * @returns {number} Daily power in kWh
 */
function calculateDailyPower(psh, panelWatts) {
  return psh * (panelWatts / 1000);
}

/**
 * Get number of days in each month (accounting for leap years)
 * Uses a standard year (non-leap year) for consistency
 * @returns {Array<number>} Array of 12 numbers representing days in each month
 */
function getDaysInMonths() {
  // Standard year: Jan=31, Feb=28, Mar=31, Apr=30, May=31, Jun=30,
  // Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

/**
 * Get PSH value based on selected tilt method
 * @param {Object} solarMonth - Solar data for a month
 * @param {string} tiltMethod - 'monthlyOptimal', 'yearlyFixed', or 'flat'
 * @returns {number} PSH value
 */
function getPshForMethod(solarMonth, tiltMethod) {
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
 * @param {number} dayOfYear - Day of year (1-365)
 * @param {number} latitude - Latitude in degrees
 * @returns {{ sunrise: number, sunset: number, daylightHours: number }}
 */
function calculateDaylightHours(dayOfYear, latitude) {
  // Solar declination (approximate)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const declinationRad = declination * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  
  // Hour angle at sunrise/sunset
  let cosHourAngle = -Math.tan(latRad) * Math.tan(declinationRad);
  
  // Handle polar day/night
  if (cosHourAngle < -1) {
    // Polar day - 24 hours of sunlight
    return { sunrise: 0, sunset: 24, daylightHours: 24 };
  } else if (cosHourAngle > 1) {
    // Polar night - 0 hours of sunlight
    return { sunrise: 12, sunset: 12, daylightHours: 0 };
  }
  
  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
  const daylightHours = (2 * hourAngle) / 15; // Convert degrees to hours
  
  // Calculate sunrise and sunset times (solar time, centered on noon)
  const sunrise = 12 - (daylightHours / 2);
  const sunset = 12 + (daylightHours / 2);
  
  return { sunrise, sunset, daylightHours };
}

/**
 * Generate hourly power profile using sinusoidal solar radiation model
 * @param {number} dailyPower - Total daily power in kWh
 * @param {number} monthIndex - Month index (0-11)
 * @param {number} latitude - Location latitude
 * @returns {Array<number>} Array of 24 hourly power values
 */
function generateHourlyProfile(dailyPower, monthIndex, latitude) {
  const dayOfYear = MID_MONTH_DOY[monthIndex];
  const { sunrise, sunset, daylightHours } = calculateDaylightHours(dayOfYear, latitude);
  
  if (daylightHours === 0) {
    return new Array(24).fill(0);
  }
  
  const hourlyValues = [];
  let totalArea = 0;
  
  // First pass: calculate raw sinusoidal values
  const rawValues = [];
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
 * Destroy all power generation charts
 */
export function destroyPowerGenCharts() {
  powerGenChart = safeDestroyChart(powerGenChart);
  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);
}

/**
 * Update power generation charts when theme changes
 * Re-renders existing charts with new theme colors
 */
export function updatePowerGenChartsTheme() {
  // Update Chart.js defaults
  updateChartDefaults();
  
  // Re-render monthly chart if it exists
  if (powerGenChart && currentSolarData) {
    renderPowerGenChart();
  }
  
  // Re-render hourly chart if it exists and is visible
  if (hourlyPowerChart && currentSolarData && currentLatitude !== null && currentPanelWatts && hourlyPowerContainer && !hourlyPowerContainer.classList.contains('hidden')) {
    const monthIndex = extractMonthIndexFromTitle(hourlyChartTitle);
    if (monthIndex !== -1) {
      showHourlyChart(monthIndex);
    }
  }
}

/**
 * Store solar data for later use
 * @param {Array} solar - Solar data array from API
 * @param {number} latitude - Location latitude
 */
export function setSolarData(solar, latitude) {
  currentSolarData = solar;
  currentLatitude = latitude;
}

/**
 * Get the current wattage from input
 * @returns {number|null}
 */
function getInputWattage() {
  return panelWattageInput?.value ? parseInt(panelWattageInput.value, 10) : null;
}

/**
 * Render the monthly power generation chart with all three tilt methods
 */
export function renderPowerGenChart() {
  if (!powerGenChartEl || !currentSolarData) return;
  
  const watts = getInputWattage();
  
  // Show placeholder if no wattage entered
  if (!watts || watts <= 0) {
    if (powerGenPlaceholder) powerGenPlaceholder.classList.remove('hidden');
    if (powerGenLabel) powerGenLabel.classList.add('hidden');
    powerGenChartEl.classList.add('hidden');
    powerGenChart = safeDestroyChart(powerGenChart);
    currentPanelWatts = null;
    return;
  }
  
  // Store current wattage for hourly chart
  currentPanelWatts = watts;
  
  // Hide placeholder, show chart and label
  if (powerGenPlaceholder) powerGenPlaceholder.classList.add('hidden');
  if (powerGenLabel) {
    powerGenLabel.classList.remove('hidden');
    // Update label text based on view mode
    if (currentViewMode === 'monthly') {
      powerGenLabel.textContent = 'Total monthly power generation (kWh/month) for each month, comparing Monthly Optimal Tilt, Yearly Fixed Tilt, and Flat (0°) configurations. Click any bar to see the hourly breakdown for that month and tilt method.';
    } else {
      powerGenLabel.textContent = 'Average daily power generation (kWh/day) for each month, comparing Monthly Optimal Tilt, Yearly Fixed Tilt, and Flat (0°) configurations. Click any bar to see the hourly breakdown for that month and tilt method.';
    }
  }
  powerGenChartEl.classList.remove('hidden');
  
  updateChartDefaults();
  
  const ctx = powerGenChartEl.getContext('2d');
  powerGenChart = safeDestroyChart(powerGenChart);

  // Calculate rounding factor from config
  const roundingFactor = Math.pow(10, POWER_ROUNDING_DECIMALS);
  const daysInMonths = getDaysInMonths();

  // Calculate power for each month and each tilt method in a single pass
  const chartData = currentSolarData.reduce((acc, s, index) => {
    acc.labels.push(s.month);
    
    // Calculate daily power first
    const dailyMonthlyOptimal = calculateDailyPower(s.monthlyOptimal.psh, watts);
    const dailyYearlyFixed = calculateDailyPower(s.yearlyFixed.psh, watts);
    const dailyFlat = calculateDailyPower(s.flat.psh, watts);
    
    // Convert to monthly totals if in monthly view mode
    const daysInMonth = daysInMonths[index];
    const monthlyOptimalValue = currentViewMode === 'monthly' 
      ? dailyMonthlyOptimal * daysInMonth 
      : dailyMonthlyOptimal;
    const yearlyFixedValue = currentViewMode === 'monthly'
      ? dailyYearlyFixed * daysInMonth
      : dailyYearlyFixed;
    const flatValue = currentViewMode === 'monthly'
      ? dailyFlat * daysInMonth
      : dailyFlat;
    
    acc.monthlyOptimalData.push(
      Math.round(monthlyOptimalValue * roundingFactor) / roundingFactor
    );
    acc.yearlyFixedData.push(
      Math.round(yearlyFixedValue * roundingFactor) / roundingFactor
    );
    acc.flatData.push(
      Math.round(flatValue * roundingFactor) / roundingFactor
    );
    return acc;
  }, {
    labels: [],
    monthlyOptimalData: [],
    yearlyFixedData: [],
    flatData: []
  });

  const { labels, monthlyOptimalData, yearlyFixedData, flatData } = chartData;

  // Get the yearly fixed tilt value for label (same for all months)
  const yearlyFixedTilt = currentSolarData[0]?.yearlyFixed?.tilt || '';

  // Calculate Y-axis bounds from all datasets
  const allPowerValues = [...monthlyOptimalData, ...yearlyFixedData, ...flatData];
  const maxPower = Math.max(...allPowerValues);
  const yAxisMax = Math.ceil(maxPower * 1.15 * 10) / 10;

  const theme = getCurrentTheme();

  // Colors matching the PSH chart
  const monthlyColor = theme === 'light' ? '#D97706' : '#F5A623';
  const yearlyColor = theme === 'light' ? '#0369A1' : '#0096C7';
  const flatColor = theme === 'light' ? '#78716C' : '#8DA4BE';

  powerGenChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Optimal Tilt',
          data: monthlyOptimalData,
          backgroundColor: monthlyColor,
          hoverBackgroundColor: monthlyColor,
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: `Yearly Fixed Tilt (${yearlyFixedTilt})`,
          data: yearlyFixedData,
          backgroundColor: yearlyColor,
          hoverBackgroundColor: yearlyColor,
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Flat (0°)',
          data: flatData,
          backgroundColor: flatColor,
          hoverBackgroundColor: flatColor,
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const element = elements[0];
          const monthIndex = element.index;
          // Show hourly breakdown for all three tilt methods
          showHourlyChart(monthIndex);
        }
      },
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context) => {
              const unit = currentViewMode === 'monthly' ? 'kWh/month' : 'kWh/day';
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${unit}`;
            },
            afterBody: () => 'Click for hourly breakdown'
          }
        }
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis(
          currentViewMode === 'monthly' ? 'Monthly Power (kWh)' : 'Daily Power (kWh)', 
          'left', 
          0, 
          yAxisMax
        )
      }
    }
  });

  // Also render table if it exists
  if (currentSolarData && watts) {
    renderPowerGenTable(currentSolarData, watts);
  }
}

/**
 * Show the hourly power chart for a specific month with all three tilt methods
 * @param {number} monthIndex - Month index (0-11)
 */
function showHourlyChart(monthIndex) {
  if (!hourlyPowerChartEl || !hourlyPowerContainer || currentLatitude === null || !currentSolarData || !currentPanelWatts) return;
  
  // Hide monthly chart container, show hourly
  if (powerGenContainer) powerGenContainer.classList.add('hidden');
  hourlyPowerContainer.classList.remove('hidden');
  
  // Update title
  if (hourlyChartTitle) {
    hourlyChartTitle.textContent = `Hourly Power Generation - ${MONTH_FULL[monthIndex]}`;
  }
  
  // Get daily power for each tilt method
  const solarMonth = currentSolarData[monthIndex];
  const monthlyOptimalDailyPower = calculateDailyPower(solarMonth.monthlyOptimal.psh, currentPanelWatts);
  const yearlyFixedDailyPower = calculateDailyPower(solarMonth.yearlyFixed.psh, currentPanelWatts);
  const flatDailyPower = calculateDailyPower(solarMonth.flat.psh, currentPanelWatts);

  // Get the yearly fixed tilt value for label (same for all months)
  const yearlyFixedTilt = currentSolarData[0]?.yearlyFixed?.tilt || '';

  // Generate hourly profiles for all three tilt methods
  const monthlyOptimalHourly = generateHourlyProfile(monthlyOptimalDailyPower, monthIndex, currentLatitude);
  const yearlyFixedHourly = generateHourlyProfile(yearlyFixedDailyPower, monthIndex, currentLatitude);
  const flatHourly = generateHourlyProfile(flatDailyPower, monthIndex, currentLatitude);

  updateChartDefaults();

  const ctx = hourlyPowerChartEl.getContext('2d');
  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);

  // Create labels with better spacing - show every 2 hours to prevent overflow
  const labels = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 || 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour}${ampm}`;
  });

  // Calculate Y-axis max from all datasets
  const allPowerValues = [...monthlyOptimalHourly, ...yearlyFixedHourly, ...flatHourly];
  const maxPower = Math.max(...allPowerValues);
  const yAxisMax = Math.ceil(maxPower * 1.15 * 100) / 100;

  const theme = getCurrentTheme();

  // Colors matching the bar chart
  const monthlyColor = theme === 'light' ? '#D97706' : '#F5A623';
  const monthlyFill = theme === 'light' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(245, 166, 35, 0.1)';

  const yearlyColor = theme === 'light' ? '#0369A1' : '#0096C7';
  const yearlyFill = theme === 'light' ? 'rgba(3, 105, 161, 0.1)' : 'rgba(0, 150, 199, 0.1)';

  const flatColor = theme === 'light' ? '#78716C' : '#8DA4BE';
  const flatFill = theme === 'light' ? 'rgba(120, 113, 108, 0.1)' : 'rgba(141, 164, 190, 0.1)';

  hourlyPowerChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Optimal Tilt',
          data: monthlyOptimalHourly,
          borderColor: monthlyColor,
          backgroundColor: monthlyFill,
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: monthlyColor
        },
        {
          label: `Yearly Fixed Tilt (${yearlyFixedTilt})`,
          data: yearlyFixedHourly,
          borderColor: yearlyColor,
          backgroundColor: yearlyFill,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: yearlyColor
        },
        {
          label: 'Flat (0°)',
          data: flatHourly,
          borderColor: flatColor,
          backgroundColor: flatFill,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: flatColor,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(3)} kWh`
          }
        }
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        x: {
          ...CHART_COMMON_OPTIONS.scales.x,
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            maxTicksLimit: 12,
            font: {
              size: 10
            },
            padding: 8
          },
          grid: {
            ...CHART_COMMON_OPTIONS.scales.x.grid,
            offset: false
          }
        },
        y: createYAxis('Power (kWh)', 'left', 0, yAxisMax)
      },
      layout: {
        padding: {
          bottom: 20
        }
      }
    }
  });
}

/**
 * Show the monthly chart (hide hourly)
 */
export function showMonthlyChart() {
  if (powerGenContainer) powerGenContainer.classList.remove('hidden');
  if (hourlyPowerContainer) hourlyPowerContainer.classList.add('hidden');
  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);
}

/**
 * Setup event listeners for power generation calculator
 */
export function setupPowerGenListeners() {
  // Wattage input change
  if (panelWattageInput) {
    panelWattageInput.addEventListener('input', () => {
      renderPowerGenChart();
      
      // If hourly chart is visible, update it with new wattage
      if (hourlyPowerChart && currentSolarData && currentLatitude !== null && hourlyPowerContainer && !hourlyPowerContainer.classList.contains('hidden')) {
        const monthIndex = extractMonthIndexFromTitle(hourlyChartTitle);
        if (monthIndex !== -1) {
          showHourlyChart(monthIndex);
        }
      }
    });
  }
  
  // Back button
  if (hourlyBackBtn) {
    hourlyBackBtn.addEventListener('click', () => {
      showMonthlyChart();
    });
  }
  
  // View mode toggle buttons (Daily/Monthly)
  const dailyToggleBtn = querySelector('[data-section="power-gen-view"][data-view="daily"]');
  const monthlyToggleBtn = querySelector('[data-section="power-gen-view"][data-view="monthly"]');
  
  if (dailyToggleBtn) {
    dailyToggleBtn.addEventListener('click', () => {
      if (currentViewMode !== 'daily') {
        currentViewMode = 'daily';
        dailyToggleBtn.classList.add('active');
        if (monthlyToggleBtn) monthlyToggleBtn.classList.remove('active');
        renderPowerGenChart();
      }
    });
  }
  
  if (monthlyToggleBtn) {
    monthlyToggleBtn.addEventListener('click', () => {
      if (currentViewMode !== 'monthly') {
        currentViewMode = 'monthly';
        monthlyToggleBtn.classList.add('active');
        if (dailyToggleBtn) dailyToggleBtn.classList.remove('active');
        renderPowerGenChart();
      }
    });
  }
}

/**
 * Initialize power generation calculator with data
 * @param {Array} solar - Solar data array from API
 * @param {number} latitude - Location latitude
 */
export function initPowerGenCalculator(solar, latitude) {
  setSolarData(solar, latitude);
  renderPowerGenChart();
}

/**
 * Get power generation chart instance
 * @returns {Chart|null}
 */
export function getPowerGenChart() {
  return powerGenChart;
}

// Expose functions globally for charts.js integration (avoids circular imports)
window.destroyPowerGenCharts = destroyPowerGenCharts;
window.updatePowerGenChartsTheme = updatePowerGenChartsTheme;