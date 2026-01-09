/**
 * Chart rendering module
 */

import { weatherChartEl, solarChartEl, solarTiltChartEl } from './dom.js';
import { createRgbaColor } from './utils.js';
import { Y_AXIS_PADDING_FACTOR } from './config.js';
import { getCurrentTheme } from './theme.js';

// Chart instances
let weatherChart = null;
let solarChart = null;
let solarTiltChart = null;

// Store chart data for re-rendering on theme change
let storedWeatherData = null;
let storedSolarData = null;

// Chart resize debouncing
let chartResizeTimeout = null;

/**
 * Update Chart.js defaults based on current theme
 */
function updateChartDefaults() {
  const theme = getCurrentTheme();
  Chart.defaults.font.family = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  
  if (theme === 'light') {
    // Darker grey for light mode - matches --text-secondary in light theme
    Chart.defaults.color = '#57534E';
    Chart.defaults.borderColor = 'rgba(120, 113, 108, 0.15)';
  } else {
    // Original colors for dark mode
    Chart.defaults.color = '#8DA4BE';
    Chart.defaults.borderColor = 'rgba(141, 164, 190, 0.15)';
  }
}

// Initialize Chart.js defaults
updateChartDefaults();

// Shared chart configuration
export const CHART_COMMON_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 12,
        usePointStyle: true,
        padding: 16
      }
    },
    tooltip: {
      backgroundColor: 'rgba(21, 29, 39, 0.95)',
      titleColor: '#F0F4F8',
      bodyColor: '#8DA4BE',
      borderColor: 'rgba(141, 164, 190, 0.2)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      }
    }
  }
};

// Common scale configurations
export const createYAxis = (title, position = 'left', min = null, max = null) => {
  const theme = getCurrentTheme();
  const gridColor = theme === 'light' 
    ? 'rgba(120, 113, 108, 0.1)' 
    : 'rgba(141, 164, 190, 0.1)';
  
  return {
    type: 'linear',
    display: true,
    position,
    title: { display: true, text: title },
    min,
    max,
    grid: position === 'left' 
      ? { color: gridColor }
      : { drawOnChartArea: false }
  };
};

/**
 * Safely destroy a chart instance
 * @param {Chart|null} chart - Chart instance to destroy
 * @returns {null}
 */
function safeDestroyChart(chart) {
  if (chart) {
    chart.destroy();
  }
  return null;
}

/**
 * Destroy all chart instances
 * @param {boolean} includePowerGen - Whether to also destroy power generation charts
 */
export function destroyAllCharts(includePowerGen = true) {
  weatherChart = safeDestroyChart(weatherChart);
  solarChart = safeDestroyChart(solarChart);
  solarTiltChart = safeDestroyChart(solarTiltChart);
  
  // Power gen charts are destroyed via their own module to avoid circular imports
  if (includePowerGen && typeof window.destroyPowerGenCharts === 'function') {
    window.destroyPowerGenCharts();
  }
}

/**
 * Debounced chart resize helper
 * @param {Chart|null} chart - Chart instance
 * @param {number} delay - Delay in milliseconds
 */
export function debounceChartResize(chart, delay = 100) {
  if (chartResizeTimeout) {
    clearTimeout(chartResizeTimeout);
  }
  chartResizeTimeout = setTimeout(() => {
    if (chart) {
      chart.resize();
    }
    chartResizeTimeout = null;
  }, delay);
}

/**
 * Helper to create line dataset
 * @param {string} label - Dataset label
 * @param {Array} data - Data array
 * @param {string} color - Color (hex or rgba)
 * @param {Object} options - Additional options
 * @returns {Object} Chart.js dataset configuration
 */
function createLineDataset(label, data, color, options = {}) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: createRgbaColor(color, 0.1),
    borderWidth: options.borderWidth || 2,
    tension: 0.3,
    pointRadius: options.pointRadius || 4,
    pointHoverRadius: options.pointHoverRadius || 6,
    pointBackgroundColor: color,
    fill: options.fill || false,
    ...options
  };
}

/**
 * Helper to create bar dataset
 * @param {string} label - Dataset label
 * @param {Array} data - Data array
 * @param {string} color - Color (hex or rgba)
 * @param {string} yAxisID - Y-axis ID
 * @param {number} order - Dataset order
 * @returns {Object} Chart.js dataset configuration
 */
function createBarDataset(label, data, color, yAxisID, order) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: createRgbaColor(color, 0.3),
    borderWidth: 0,
    type: 'bar',
    yAxisID,
    order
  };
}

/**
 * Parse tilt angle from string like "45° N" or "30° S"
 * Returns negative values for North, positive for South
 * @param {string} tiltString - Tilt angle string
 * @returns {number} Tilt angle in degrees
 */
function parseTiltAngle(tiltString) {
  if (!tiltString || typeof tiltString !== 'string') return 0;
  const match = tiltString.match(/(\d+)\s*°\s*([NS])?/i);
  if (!match) return 0;
  
  const angle = parseInt(match[1], 10);
  if (isNaN(angle)) return 0;
  
  const direction = match[2]?.toUpperCase();
  
  // North-facing tilts are negative, South-facing are positive
  if (direction === 'N') {
    return -angle;
  } else if (direction === 'S') {
    return angle;
  }
  
  // If no direction specified, assume it's the absolute value (likely 0°)
  return angle;
}

/**
 * Render the weather chart
 * @param {Array} weather - Weather data array
 */
export function renderWeatherChart(weather) {
  if (!weatherChartEl) return;
  
  // Store data for theme updates
  storedWeatherData = weather;
  
  // Update Chart.js defaults based on current theme
  updateChartDefaults();
  
  const ctx = weatherChartEl.getContext('2d');
  
  weatherChart = safeDestroyChart(weatherChart);
  
  // Extract data arrays directly in a single pass
  const labels = weather.map(w => w.month);
  const highF = weather.map(w => w.highF);
  const meanF = weather.map(w => w.meanF);
  const lowF = weather.map(w => w.lowF);
  const humidity = weather.map(w => w.humidity);
  
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('High (°F)', highF, '#DC2F02', { yAxisID: 'y' }),
        createLineDataset('Mean (°F)', meanF, '#F5A623', { yAxisID: 'y' }),
        createLineDataset('Low (°F)', lowF, '#0096C7', { yAxisID: 'y' }),
        createBarDataset('Humidity (%)', humidity, '#10B981', 'y1', 2)
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis('Temperature (°F)'),
        y1: { ...createYAxis('Humidity (%)', 'right', 0, 100), display: true }
      }
    }
  });
}

/**
 * Render the solar PSH chart
 * @param {Array} solar - Solar data array
 */
export function renderSolarChart(solar) {
  if (!solarChartEl) return;
  
  // Store data for theme updates
  storedSolarData = solar;
  
  // Update Chart.js defaults based on current theme
  updateChartDefaults();
  
  const ctx = solarChartEl.getContext('2d');
  
  solarChart = safeDestroyChart(solarChart);
  
  // Extract data arrays directly in a single pass
  const labels = solar.map(s => s.month);
  const monthlyOptimalPsh = solar.map(s => s.monthlyOptimal.psh);
  const yearlyFixedPsh = solar.map(s => s.yearlyFixed.psh);
  const flatPsh = solar.map(s => s.flat.psh);

  // Calculate dynamic Y-axis bounds based on data range
  const allPsh = [...monthlyOptimalPsh, ...yearlyFixedPsh, ...flatPsh];
  const minPsh = Math.min(...allPsh);
  const maxPsh = Math.max(...allPsh);

  // Add padding and round to nearest 0.5 for clean axis labels
  const yAxisMin = Math.floor((minPsh * 0.9) * 2) / 2;
  const yAxisMax = Math.ceil((maxPsh * 1.1) * 2) / 2;

  // Get theme-aware colors matching the power generation chart
  const theme = getCurrentTheme();
  const monthlyColor = theme === 'light' ? '#D97706' : '#F5A623';
  const yearlyColor = theme === 'light' ? '#0369A1' : '#0096C7';
  const flatColor = theme === 'light' ? '#78716C' : '#8DA4BE';

  solarChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('Monthly Optimal Tilt', monthlyOptimalPsh, monthlyColor, {
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true
        }),
        createLineDataset('Yearly Fixed Tilt', yearlyFixedPsh, yearlyColor),
        createLineDataset('Flat (0°)', flatPsh, flatColor, {
          borderDash: [5, 5]
        })
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y} kWh/m²/day`
          }
        }
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis('Peak Sun Hours (kWh/m²/day)', 'left', yAxisMin, yAxisMax)
      }
    }
  });
}

/**
 * Render the solar tilt angle chart
 * @param {Array} solar - Solar data array
 */
export function renderSolarTiltChart(solar) {
  if (!solarTiltChartEl) return;
  
  // Store data for theme updates (already stored in renderSolarChart, but ensure it's set)
  storedSolarData = solar;
  
  // Update Chart.js defaults based on current theme
  updateChartDefaults();
  
  const ctx = solarTiltChartEl.getContext('2d');
  
  solarTiltChart = safeDestroyChart(solarTiltChart);
  
  // Extract and parse all data in a single pass
  const labels = solar.map(s => s.month);
  const monthlyOptimalTilt = solar.map(s => parseTiltAngle(s.monthlyOptimal.tilt));
  const yearlyFixedTilt = solar.map(s => parseTiltAngle(s.yearlyFixed.tilt));
  
  // Find the range of tilt angles to set appropriate Y-axis bounds
  const allTilts = [...monthlyOptimalTilt, ...yearlyFixedTilt];
  const maxAbsTilt = allTilts.length > 0 
    ? Math.max(...allTilts.map(Math.abs))
    : 90; // Default to 90 if no data
  const yAxisMax = Math.ceil(maxAbsTilt * Y_AXIS_PADDING_FACTOR);
  const yAxisMin = -yAxisMax; // Symmetric around 0
  
  // Get theme-aware colors matching the PSH chart
  const theme = getCurrentTheme();
  const monthlyColor = theme === 'light' ? '#D97706' : '#F5A623';
  const yearlyColor = theme === 'light' ? '#0369A1' : '#0096C7';
  
  solarTiltChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('Monthly Optimal Tilt', monthlyOptimalTilt, monthlyColor, {
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true
        }),
        createLineDataset('Yearly Fixed Tilt', yearlyFixedTilt, yearlyColor, {
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        })
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context) => {
              const tiltValue = context.parsed.y;
              const absValue = Math.abs(tiltValue);
              const direction = tiltValue < 0 ? 'N' : tiltValue > 0 ? 'S' : '';
              
              return `${context.dataset.label}: ${absValue}°${direction ? ' ' + direction : ''}`;
            }
          }
        }
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Tilt Angle (degrees)' },
          min: yAxisMin,
          max: yAxisMax,
          ticks: {
            callback: function(value) {
              const absValue = Math.abs(value);
              const direction = value < 0 ? 'N' : value > 0 ? 'S' : '';
              return absValue + '°' + (direction ? ' ' + direction : '');
            }
          },
          grid: {
            color: function(context) {
              const theme = getCurrentTheme();
              const baseColor = theme === 'light' 
                ? 'rgba(120, 113, 108, 0.1)' 
                : 'rgba(141, 164, 190, 0.1)';
              const highlightColor = theme === 'light'
                ? 'rgba(120, 113, 108, 0.4)'
                : 'rgba(141, 164, 190, 0.4)';
              
              // Highlight the 0° line
              if (context.tick && context.tick.value === 0) {
                return highlightColor;
              }
              return baseColor;
            },
            lineWidth: function(context) {
              // Make the 0° line thicker
              if (context.tick && context.tick.value === 0) {
                return 2;
              }
              return 1;
            }
          }
        }
      }
    }
  });
}

/**
 * Update all charts when theme changes
 * Re-renders all existing charts with new theme colors
 */
export function updateChartsTheme() {
  // Update Chart.js defaults
  updateChartDefaults();
  
  // Re-render all charts if they exist and have data
  if (storedWeatherData && weatherChart) {
    renderWeatherChart(storedWeatherData);
  }
  
  if (storedSolarData && solarChart) {
    renderSolarChart(storedSolarData);
  }
  
  if (storedSolarData && solarTiltChart) {
    renderSolarTiltChart(storedSolarData);
  }
  
  // Update power generation charts if they exist
  if (typeof window.updatePowerGenChartsTheme === 'function') {
    window.updatePowerGenChartsTheme();
  }
}

// Export chart instances for external access
export function getWeatherChart() { return weatherChart; }
export function getSolarChart() { return solarChart; }
export function getSolarTiltChart() { return solarTiltChart; }

