/**
 * Power generation module index
 * Main entry point for power generation calculator
 */

import {
  getPanelWattageInput,
  getHourlyBackBtn,
  getHourlyPowerContainer,
  getHourlyChartTitle,
  getPowerGenDailyToggleBtn,
  getPowerGenMonthlyToggleBtn,
} from '@services/domService';
import type { SolarMonthData } from '../../types/solar';
import { extractMonthIndexFromTitle } from './calculator';
import {
  setSolarData,
  renderPowerGenChart,
  showMonthlyChart,
  showHourlyChart,
  getHourlyPowerChart,
  getViewMode,
  setViewMode,
} from './charts';

// Re-export calculator functions
export {
  calculateDailyPower,
  generateHourlyProfile,
  getDaysInMonths,
  MONTH_FULL,
} from './calculator';

// Re-export chart functions
export {
  getPowerGenChart,
  showMonthlyChart,
  showHourlyChart,
  renderPowerGenChart,
  getViewMode,
  setViewMode,
} from './charts';

/**
 * Setup event listeners for power generation calculator
 */
export function setupPowerGenListeners(): void {
  const panelWattageInput = getPanelWattageInput();
  const hourlyBackBtn = getHourlyBackBtn();

  // Wattage input change
  if (panelWattageInput) {
    panelWattageInput.addEventListener('input', () => {
      renderPowerGenChart();

      // If hourly chart is visible, update it with new wattage
      const hourlyPowerContainer = getHourlyPowerContainer();
      const hourlyChartTitle = getHourlyChartTitle();
      const hourlyPowerChart = getHourlyPowerChart();

      if (
        hourlyPowerChart &&
        hourlyPowerContainer &&
        !hourlyPowerContainer.classList.contains('hidden')
      ) {
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
  const dailyToggleBtn = getPowerGenDailyToggleBtn();
  const monthlyToggleBtn = getPowerGenMonthlyToggleBtn();

  if (dailyToggleBtn) {
    dailyToggleBtn.addEventListener('click', () => {
      if (getViewMode() !== 'daily') {
        setViewMode('daily');
        dailyToggleBtn.classList.add('active');
        if (monthlyToggleBtn) monthlyToggleBtn.classList.remove('active');
        renderPowerGenChart();
      }
    });
  }

  if (monthlyToggleBtn) {
    monthlyToggleBtn.addEventListener('click', () => {
      if (getViewMode() !== 'monthly') {
        setViewMode('monthly');
        monthlyToggleBtn.classList.add('active');
        if (dailyToggleBtn) dailyToggleBtn.classList.remove('active');
        renderPowerGenChart();
      }
    });
  }
}

/**
 * Initialize power generation calculator with data
 */
export function initPowerGenCalculator(solar: SolarMonthData[], latitude: number): void {
  setSolarData(solar, latitude);
  setupPowerGenListeners();
  renderPowerGenChart();
}
