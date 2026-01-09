/**
 * DOM element references
 * Standardized access to DOM elements
 */

// Cache for lazy-loaded elements
const elementCache = {};

/**
 * Get DOM element by ID (cached for performance)
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
  if (!elementCache[id]) {
    elementCache[id] = document.getElementById(id);
  }
  return elementCache[id];
}

/**
 * Get DOM element by query selector
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null}
 */
export function querySelector(selector) {
  return document.querySelector(selector);
}

/**
 * Get all DOM elements matching selector
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
export function querySelectorAll(selector) {
  return document.querySelectorAll(selector);
}

// Pre-cached elements (always available)
export const loginPage = getElement('login-page');
export const mainApp = getElement('main-app');
export const loginForm = getElement('login-form');
export const passwordInput = getElement('password-input');
export const loginBtn = getElement('login-btn');
export const loginError = getElement('login-error');
export const loginErrorText = getElement('login-error-text');
export const searchForm = getElement('search-form');
export const locationInput = getElement('location-input');
export const submitBtn = getElement('submit-btn');
export const autocompleteDropdown = getElement('autocomplete-dropdown');
export const loadingEl = getElement('loading');
export const errorEl = getElement('error');
export const errorText = getElement('error-text');
export const resultsEl = getElement('results');
export const resolvedLocationEl = getElement('resolved-location');
export const coordinatesEl = getElement('coordinates');
export const yearsInfoEl = getElement('years-info');
export const weatherTableBody = querySelector('#weather-table tbody');
export const solarTableBody = querySelector('#solar-table tbody');
export const cacheInfoEl = getElement('cache-info');
export const clearCacheBtn = getElement('clear-cache-btn');
export const solarGraphToggle = getElement('solar-graph-toggle');
export const solarPshLabel = getElement('solar-psh-label');
export const solarTiltLabel = getElement('solar-tilt-label');
export const weatherChartEl = getElement('weather-chart');
export const solarChartEl = getElement('solar-chart');
export const solarTiltChartEl = getElement('solar-tilt-chart');
export const themeToggleBtns = querySelectorAll('.theme-toggle-btn');

// Power Generation Calculator elements
export const panelWattageInput = getElement('panel-wattage');
export const powerGenLabel = getElement('power-gen-label');
export const powerGenChartEl = getElement('power-gen-chart');
export const powerGenPlaceholder = getElement('power-gen-placeholder');
export const powerGenContainer = getElement('power-gen-container');
export const hourlyPowerChartEl = getElement('hourly-power-chart');
export const hourlyPowerContainer = getElement('hourly-power-container');
export const hourlyBackBtn = getElement('hourly-back-btn');
export const hourlyChartTitle = getElement('hourly-chart-title');
