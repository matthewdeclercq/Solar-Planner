/**
 * DOM element service
 * Provides typed access to DOM elements with caching
 */

// Cache for lazy-loaded elements
const elementCache = new Map<string, HTMLElement | null>();

/**
 * Get DOM element by ID (cached for performance)
 */
export function getElementById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  if (!elementCache.has(id)) {
    elementCache.set(id, document.getElementById(id));
  }
  return elementCache.get(id) as T | null;
}

/**
 * Get DOM element by query selector
 */
export function querySelector<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

/**
 * Get all DOM elements matching selector
 */
export function querySelectorAll<T extends HTMLElement = HTMLElement>(
  selector: string
): NodeListOf<T> {
  return document.querySelectorAll<T>(selector);
}

/**
 * Clear element cache (useful for testing or dynamic DOM changes)
 */
export function clearElementCache(): void {
  elementCache.clear();
}

// Chart canvas elements
export const getWeatherChartEl = () => getElementById<HTMLCanvasElement>('weather-chart');
export const getSolarChartEl = () => getElementById<HTMLCanvasElement>('solar-chart');
export const getSolarTiltChartEl = () => getElementById<HTMLCanvasElement>('solar-tilt-chart');
export const getPowerGenChartEl = () => getElementById<HTMLCanvasElement>('power-gen-chart');
export const getHourlyPowerChartEl = () => getElementById<HTMLCanvasElement>('hourly-power-chart');

// Table body elements
export const getWeatherTableBody = () =>
  querySelector<HTMLTableSectionElement>('#weather-table tbody');
export const getSolarTableBody = () => querySelector<HTMLTableSectionElement>('#solar-table tbody');
export const getPowerGenTableBody = () =>
  querySelector<HTMLTableSectionElement>('#power-gen-table tbody');

// Power generation elements
export const getPanelWattageInput = () => getElementById<HTMLInputElement>('panel-wattage');
export const getPowerGenLabel = () => getElementById('power-gen-label');
export const getPowerGenPlaceholder = () => getElementById('power-gen-placeholder');
export const getPowerGenContainer = () => getElementById('power-gen-container');
export const getHourlyPowerContainer = () => getElementById('hourly-power-container');
export const getHourlyBackBtn = () => getElementById('hourly-back-btn');
export const getHourlyChartTitle = () => getElementById('hourly-chart-title');
export const getPowerGenViewToggle = () => getElementById('power-gen-view-toggle');

// Power gen table total elements
export const getPowerGenMonthlyOptimalTotal = () =>
  getElementById('power-gen-monthly-optimal-total');
export const getPowerGenYearlyFixedTotal = () => getElementById('power-gen-yearly-fixed-total');
export const getPowerGenFlatTotal = () => getElementById('power-gen-flat-total');

// Solar toggle elements
export const getSolarGraphToggle = () => getElementById('solar-graph-toggle');
export const getSolarPshLabel = () => getElementById('solar-psh-label');
export const getSolarTiltLabel = () => getElementById('solar-tilt-label');

// Results elements
export const getResultsEl = () => getElementById('results');
export const getResolvedLocationEl = () => getElementById('resolved-location');
export const getCoordinatesEl = () => getElementById('coordinates');
export const getYearsInfoEl = () => getElementById('years-info');
export const getCacheInfoEl = () => getElementById('cache-info');
export const getCacheInfoText = () => getElementById('cache-info-text');
export const getClearCacheBtn = () => getElementById('clear-cache-btn');

// View toggle buttons
export const getPowerGenDailyToggleBtn = () =>
  querySelector<HTMLButtonElement>('[data-section="power-gen-view"][data-view="daily"]');
export const getPowerGenMonthlyToggleBtn = () =>
  querySelector<HTMLButtonElement>('[data-section="power-gen-view"][data-view="monthly"]');
