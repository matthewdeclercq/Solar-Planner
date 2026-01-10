/**
 * Power generation charts component
 */

import { getChart, type ChartInstance } from '@utils/chartGlobal';
import {
  getPowerGenChartEl,
  getHourlyPowerChartEl,
  getPowerGenLabel,
  getPowerGenPlaceholder,
  getPowerGenContainer,
  getHourlyPowerContainer,
  getHourlyChartTitle,
  getPanelWattageInput,
} from '@services/domService';
import { getCurrentTheme } from '@services/themeService';
import { POWER_ROUNDING_DECIMALS } from '@services/configService';
import { updateChartDefaults, safeDestroyChart } from '@utils/chartUtils';
import { CHART_COMMON_OPTIONS, createYAxis, getThemeColors } from '@components/charts/chartConfig';
import { renderPowerGenTable } from '@components/tables';
import type { SolarMonthData } from '../../types/solar';
import type { PowerGenViewMode, PowerGenChartData } from '../../types/powergen';
import {
  calculateDailyPower,
  getDaysInMonths,
  generateHourlyProfile,
  extractMonthIndexFromTitle,
  MONTH_FULL,
} from './calculator';

// Chart instances
let powerGenChart: ChartInstance = null;
let hourlyPowerChart: ChartInstance = null;

// Store current data for recalculations
let currentSolarData: SolarMonthData[] | null = null;
let currentLatitude: number | null = null;
let currentPanelWatts: number | null = null;

// View mode state
let currentViewMode: PowerGenViewMode = 'daily';

/**
 * Get the current wattage from input
 */
function getInputWattage(): number | null {
  const input = getPanelWattageInput();
  return input?.value ? parseInt(input.value, 10) : null;
}

/**
 * Store solar data for later use
 */
export function setSolarData(solar: SolarMonthData[], latitude: number): void {
  currentSolarData = solar;
  currentLatitude = latitude;
}

/**
 * Get current view mode
 */
export function getViewMode(): PowerGenViewMode {
  return currentViewMode;
}

/**
 * Set view mode
 */
export function setViewMode(mode: PowerGenViewMode): void {
  currentViewMode = mode;
}

/**
 * Destroy all power generation charts
 */
export function destroyPowerGenCharts(): void {
  powerGenChart = safeDestroyChart(powerGenChart);
  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);
}

/**
 * Get power generation chart instance
 */
export function getPowerGenChart(): ChartInstance {
  return powerGenChart;
}

/**
 * Get hourly power chart instance
 */
export function getHourlyPowerChart(): ChartInstance {
  return hourlyPowerChart;
}

/**
 * Show the monthly chart (hide hourly)
 */
export function showMonthlyChart(): void {
  const powerGenContainer = getPowerGenContainer();
  const hourlyPowerContainer = getHourlyPowerContainer();

  if (powerGenContainer) powerGenContainer.classList.remove('hidden');
  if (hourlyPowerContainer) hourlyPowerContainer.classList.add('hidden');
  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);
}

/**
 * Show the hourly power chart for a specific month
 */
export function showHourlyChart(monthIndex: number): void {
  const hourlyPowerChartEl = getHourlyPowerChartEl();
  const hourlyPowerContainer = getHourlyPowerContainer();
  const powerGenContainer = getPowerGenContainer();
  const hourlyChartTitle = getHourlyChartTitle();

  if (
    !hourlyPowerChartEl ||
    !hourlyPowerContainer ||
    currentLatitude === null ||
    !currentSolarData ||
    !currentPanelWatts
  ) {
    return;
  }

  // Hide monthly chart container, show hourly
  if (powerGenContainer) powerGenContainer.classList.add('hidden');
  hourlyPowerContainer.classList.remove('hidden');

  // Update title
  if (hourlyChartTitle) {
    hourlyChartTitle.textContent = `Hourly Power Generation - ${MONTH_FULL[monthIndex]}`;
  }

  // Get daily power for each tilt method
  const solarMonth = currentSolarData[monthIndex];
  const monthlyOptimalDailyPower = calculateDailyPower(
    solarMonth.monthlyOptimal.psh,
    currentPanelWatts
  );
  const yearlyFixedDailyPower = calculateDailyPower(solarMonth.yearlyFixed.psh, currentPanelWatts);
  const flatDailyPower = calculateDailyPower(solarMonth.flat.psh, currentPanelWatts);

  // Get the yearly fixed tilt value for label
  const yearlyFixedTilt = currentSolarData[0]?.yearlyFixed?.tilt || '';

  // Generate hourly profiles for all three tilt methods
  const monthlyOptimalHourly = generateHourlyProfile(
    monthlyOptimalDailyPower,
    monthIndex,
    currentLatitude
  );
  const yearlyFixedHourly = generateHourlyProfile(
    yearlyFixedDailyPower,
    monthIndex,
    currentLatitude
  );
  const flatHourly = generateHourlyProfile(flatDailyPower, monthIndex, currentLatitude);

  updateChartDefaults();

  const ctx = hourlyPowerChartEl.getContext('2d');
  if (!ctx) return;

  hourlyPowerChart = safeDestroyChart(hourlyPowerChart);

  // Create labels
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
  const colors = getThemeColors();

  // Fill colors
  const monthlyFill = theme === 'light' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(245, 166, 35, 0.1)';
  const yearlyFill = theme === 'light' ? 'rgba(3, 105, 161, 0.1)' : 'rgba(0, 150, 199, 0.1)';
  const flatFill = theme === 'light' ? 'rgba(120, 113, 108, 0.1)' : 'rgba(141, 164, 190, 0.1)';

  const Chart = getChart();
  hourlyPowerChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Optimal Tilt',
          data: monthlyOptimalHourly,
          borderColor: colors.monthly,
          backgroundColor: monthlyFill,
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.monthly,
        },
        {
          label: `Yearly Fixed Tilt (${yearlyFixedTilt})`,
          data: yearlyFixedHourly,
          borderColor: colors.yearly,
          backgroundColor: yearlyFill,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.yearly,
        },
        {
          label: 'Flat (0°)',
          data: flatHourly,
          borderColor: colors.flat,
          backgroundColor: flatFill,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.flat,
          borderDash: [5, 5],
        },
      ],
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(3)} kWh`,
          },
        },
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
              size: 10,
            },
            padding: 8,
          },
          grid: {
            ...CHART_COMMON_OPTIONS.scales.x.grid,
            offset: false,
          },
        },
        y: createYAxis('Power (kWh)', 'left', 0, yAxisMax),
      },
      layout: {
        padding: {
          bottom: 20,
        },
      },
    },
  });
}

/**
 * Render the monthly power generation chart
 */
export function renderPowerGenChart(): void {
  const powerGenChartEl = getPowerGenChartEl();
  const powerGenPlaceholder = getPowerGenPlaceholder();
  const powerGenLabel = getPowerGenLabel();

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
      powerGenLabel.textContent =
        'Total monthly power generation (kWh/month) for each month, comparing Monthly Optimal Tilt, Yearly Fixed Tilt, and Flat (0°) configurations. Click any bar to see the hourly breakdown for that month and tilt method.';
    } else {
      powerGenLabel.textContent =
        'Average daily power generation (kWh/day) for each month, comparing Monthly Optimal Tilt, Yearly Fixed Tilt, and Flat (0°) configurations. Click any bar to see the hourly breakdown for that month and tilt method.';
    }
  }
  powerGenChartEl.classList.remove('hidden');

  updateChartDefaults();

  const ctx = powerGenChartEl.getContext('2d');
  if (!ctx) return;

  powerGenChart = safeDestroyChart(powerGenChart);

  const roundingFactor = Math.pow(10, POWER_ROUNDING_DECIMALS);
  const daysInMonths = getDaysInMonths();

  // Calculate power for each month and each tilt method
  const chartData = currentSolarData.reduce<PowerGenChartData>(
    (acc, s, index) => {
      acc.labels.push(s.month);

      // Calculate daily power first
      const dailyMonthlyOptimal = calculateDailyPower(s.monthlyOptimal.psh, watts);
      const dailyYearlyFixed = calculateDailyPower(s.yearlyFixed.psh, watts);
      const dailyFlat = calculateDailyPower(s.flat.psh, watts);

      // Convert to monthly totals if in monthly view mode
      const daysInMonth = daysInMonths[index];
      const monthlyOptimalValue =
        currentViewMode === 'monthly' ? dailyMonthlyOptimal * daysInMonth : dailyMonthlyOptimal;
      const yearlyFixedValue =
        currentViewMode === 'monthly' ? dailyYearlyFixed * daysInMonth : dailyYearlyFixed;
      const flatValue = currentViewMode === 'monthly' ? dailyFlat * daysInMonth : dailyFlat;

      acc.monthlyOptimalData.push(
        Math.round(monthlyOptimalValue * roundingFactor) / roundingFactor
      );
      acc.yearlyFixedData.push(Math.round(yearlyFixedValue * roundingFactor) / roundingFactor);
      acc.flatData.push(Math.round(flatValue * roundingFactor) / roundingFactor);
      return acc;
    },
    {
      labels: [],
      monthlyOptimalData: [],
      yearlyFixedData: [],
      flatData: [],
    }
  );

  const { labels, monthlyOptimalData, yearlyFixedData, flatData } = chartData;

  // Get the yearly fixed tilt value for label
  const yearlyFixedTilt = currentSolarData[0]?.yearlyFixed?.tilt || '';

  // Calculate Y-axis bounds from all datasets
  const allPowerValues = [...monthlyOptimalData, ...yearlyFixedData, ...flatData];
  const maxPower = Math.max(...allPowerValues);
  const yAxisMax = Math.ceil(maxPower * 1.15 * 10) / 10;

  const colors = getThemeColors();

  const Chart = getChart();
  powerGenChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Optimal Tilt',
          data: monthlyOptimalData,
          backgroundColor: colors.monthly,
          hoverBackgroundColor: colors.monthly,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: `Yearly Fixed Tilt (${yearlyFixedTilt})`,
          data: yearlyFixedData,
          backgroundColor: colors.yearly,
          hoverBackgroundColor: colors.yearly,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Flat (0°)',
          data: flatData,
          backgroundColor: colors.flat,
          hoverBackgroundColor: colors.flat,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      onClick: (_event: any, elements: any[]) => {
        if (elements.length > 0) {
          const element = elements[0];
          const monthIndex = element.index;
          showHourlyChart(monthIndex);
        }
      },
      plugins: {
        ...CHART_COMMON_OPTIONS.plugins,
        tooltip: {
          ...CHART_COMMON_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (context: any) => {
              const unit = currentViewMode === 'monthly' ? 'kWh/month' : 'kWh/day';
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${unit}`;
            },
            afterBody: () => 'Click for hourly breakdown',
          },
        },
      },
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis(
          currentViewMode === 'monthly' ? 'Monthly Power (kWh)' : 'Daily Power (kWh)',
          'left',
          0,
          yAxisMax
        ),
      },
    },
  });

  // Also render table
  if (currentSolarData && watts) {
    renderPowerGenTable({ solar: currentSolarData, watts });
  }
}

/**
 * Update power generation charts when theme changes
 */
export function updatePowerGenChartsTheme(): void {
  updateChartDefaults();

  // Re-render monthly chart if it exists
  if (powerGenChart && currentSolarData) {
    renderPowerGenChart();
  }

  // Re-render hourly chart if it exists and is visible
  const hourlyPowerContainer = getHourlyPowerContainer();
  const hourlyChartTitle = getHourlyChartTitle();

  if (
    hourlyPowerChart &&
    currentSolarData &&
    currentLatitude !== null &&
    currentPanelWatts &&
    hourlyPowerContainer &&
    !hourlyPowerContainer.classList.contains('hidden')
  ) {
    const monthIndex = extractMonthIndexFromTitle(hourlyChartTitle);
    if (monthIndex !== -1) {
      showHourlyChart(monthIndex);
    }
  }
}
