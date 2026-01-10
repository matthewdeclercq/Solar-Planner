/**
 * View toggle service
 * Handles table/graph view toggles and solar graph toggles
 */

import {
  getSolarChartEl,
  getSolarTiltChartEl,
  getSolarGraphToggle,
  getSolarPshLabel,
  getSolarTiltLabel,
  getPowerGenViewToggle,
  getHourlyPowerContainer,
  querySelectorAll,
} from '@services/domService';
import {
  debounceChartResize,
  getWeatherChart,
  getSolarChart,
  getSolarTiltChart,
} from '@components/charts';
import { getPowerGenChart, showMonthlyChart } from '@components/powergen';

/**
 * Handle solar graph toggle (PSH vs Tilt Angle)
 */
export function handleSolarGraphToggle(view: string): void {
  const solarChartEl = getSolarChartEl();
  const solarTiltChartEl = getSolarTiltChartEl();
  const solarPshLabel = getSolarPshLabel();
  const solarTiltLabel = getSolarTiltLabel();

  if (view === 'psh') {
    solarChartEl?.classList.remove('hidden');
    solarTiltChartEl?.classList.add('hidden');
    solarPshLabel?.classList.remove('hidden');
    solarTiltLabel?.classList.add('hidden');
    debounceChartResize(getSolarChart());
  } else if (view === 'tilt') {
    solarChartEl?.classList.add('hidden');
    solarTiltChartEl?.classList.remove('hidden');
    solarPshLabel?.classList.add('hidden');
    solarTiltLabel?.classList.remove('hidden');
    debounceChartResize(getSolarTiltChart());
  }
}

/**
 * Get the currently active solar graph type
 */
function getActiveSolarGraph(): string {
  const solarGraphToggle = getSolarGraphToggle();
  if (!solarGraphToggle) return 'psh';
  const activeToggle = solarGraphToggle.querySelector('.toggle-btn.active') as HTMLElement | null;
  return activeToggle?.dataset?.view || 'psh';
}

/**
 * Show correct solar label based on active graph
 */
function showCorrectSolarLabel(labelElement: HTMLElement): void {
  const solarPshLabel = getSolarPshLabel();
  const solarTiltLabel = getSolarTiltLabel();
  const activeGraph = getActiveSolarGraph();

  if (labelElement === solarPshLabel) {
    labelElement.classList.toggle('hidden', activeGraph !== 'psh');
  } else if (labelElement === solarTiltLabel) {
    labelElement.classList.toggle('hidden', activeGraph !== 'tilt');
  }
}

/**
 * Handle chart resize when activating graph view
 */
function handleGraphViewActivation(section: string): void {
  const solarGraphToggle = getSolarGraphToggle();
  const powerGenViewToggle = getPowerGenViewToggle();

  if (section === 'weather') {
    debounceChartResize(getWeatherChart());
  } else if (section === 'solar') {
    if (solarGraphToggle) solarGraphToggle.style.display = 'flex';
    debounceChartResize(getSolarChart());
  } else if (section === 'power-gen') {
    if (powerGenViewToggle) powerGenViewToggle.style.display = 'flex';
    debounceChartResize(getPowerGenChart());
  }
}

/**
 * Handle section view toggle (table vs graph)
 */
export function handleSectionViewToggle(section: string, view: string): void {
  const solarGraphToggle = getSolarGraphToggle();
  const solarPshLabel = getSolarPshLabel();
  const solarTiltLabel = getSolarTiltLabel();
  const powerGenViewToggle = getPowerGenViewToggle();
  const hourlyPowerContainer = getHourlyPowerContainer();

  const sectionContents = querySelectorAll<HTMLElement>(`[data-section="${section}"].view-content`);

  sectionContents.forEach((content) => {
    const isTargetView = content.dataset.view === view;

    if (
      section === 'solar' &&
      view === 'graph' &&
      (content === solarPshLabel || content === solarTiltLabel)
    ) {
      showCorrectSolarLabel(content);
    } else {
      content.classList.toggle('hidden', !isTargetView);
    }

    if (isTargetView && view === 'graph') {
      handleGraphViewActivation(section);
    } else if (section === 'solar' && view === 'table') {
      if (solarGraphToggle) solarGraphToggle.style.display = 'none';
    }
  });

  // Handle power-gen Daily/Monthly toggle visibility and chart state
  if (section === 'power-gen') {
    if (powerGenViewToggle) {
      powerGenViewToggle.style.display = view === 'graph' ? 'flex' : 'none';
    }
    if (view === 'table') {
      // Hide hourly chart when switching to table view
      if (hourlyPowerContainer) {
        hourlyPowerContainer.classList.add('hidden');
      }
    } else if (view === 'graph') {
      // Ensure monthly chart is shown (not hourly) when switching to graph view
      showMonthlyChart();
    }
  }
}

/**
 * Initialize view toggle functionality
 */
export function initViewToggles(): void {
  // Use event delegation for all toggle buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.toggle-btn') as HTMLElement;
    if (!button) return;

    const section = button.dataset.section;
    const view = button.dataset.view;

    if (!section || !view) return;

    // Skip power-gen-view section - handled separately in powergen component
    if (section === 'power-gen-view') {
      return;
    }

    // Update button states
    const sectionButtons = document.querySelectorAll(`[data-section="${section}"].toggle-btn`);
    sectionButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');

    // Handle solar graph toggle (PSH vs Tilt Angle)
    if (section === 'solar-graph') {
      handleSolarGraphToggle(view);
      return;
    }

    // Handle section view toggle (table vs graph)
    handleSectionViewToggle(section, view);
  });
}
