/**
 * Results display module
 */

import { resolvedLocationEl, coordinatesEl, yearsInfoEl, cacheInfoEl, cacheInfoText, clearCacheBtn, solarGraphToggle, querySelector, getElement } from './dom.js';
import { renderWeatherTable, renderSolarTable } from './tables.js';
import { renderWeatherChart, renderSolarChart, renderSolarTiltChart } from './charts.js';
import { showResults } from './ui.js';
import { fetchCachedLocations } from './api.js';
import { setCachedLocations, handleSolarGraphToggle } from './autocomplete.js';
import { initPowerGenCalculator, showMonthlyChart } from './powergen.js';

/**
 * Display the results
 * @param {Object} data - The data from the API
 * @param {string} cacheKeyLocation - The original location used to create the cache key
 */
export function displayResults(data, cacheKeyLocation) {
  // Update location info
  resolvedLocationEl.textContent = data.location;
  coordinatesEl.textContent = `${data.latitude}°, ${data.longitude}°`;
  
  // Display years of data
  const years = data.yearsOfData || 2;
  yearsInfoEl.textContent = `Averaging ${years} ${years === 1 ? 'year' : 'years'} of historical data`;
  
  // Show cache status
  if (data.cached) {
    cacheInfoText.textContent = '✓ Loaded from cache';
    cacheInfoEl.classList.add('cached');
    clearCacheBtn.classList.add('show');
  } else {
    cacheInfoText.textContent = 'Fresh data fetched';
    cacheInfoEl.classList.remove('cached');
    clearCacheBtn.classList.remove('show');
  }
  
  // Render tables
  renderWeatherTable(data.weather);
  renderSolarTable(data.solar);
  
  // Render charts
  renderWeatherChart(data.weather);
  renderSolarChart(data.solar);
  renderSolarTiltChart(data.solar);
  
  // Initialize power generation calculator with solar data and latitude
  showMonthlyChart(); // Reset to monthly view if hourly was showing
  initPowerGenCalculator(data.solar, data.latitude);
  
  // Show solar graph toggle if solar section is in graph view (default state)
  const solarGraphView = querySelector('[data-section="solar"][data-view="graph"].view-content');
  if (solarGraphView && !solarGraphView.classList.contains('hidden')) {
    if (solarGraphToggle) solarGraphToggle.style.display = 'flex';
    // Ensure correct label is shown (PSH is default)
    handleSolarGraphToggle('psh');
  }

  // Handle power-gen toggle visibility
  const powerGenGraphView = querySelector('[data-section="power-gen"][data-view="graph"].view-content');
  const powerGenViewToggle = getElement('power-gen-view-toggle');
  if (powerGenViewToggle) {
    if (powerGenGraphView && !powerGenGraphView.classList.contains('hidden')) {
      powerGenViewToggle.style.display = 'flex';
    } else {
      powerGenViewToggle.style.display = 'none';
    }
  }

  // Store the original input location used for cache key (not the resolved address)
  // This ensures cache clearing uses the same key that was used for caching
  clearCacheBtn.dataset.currentLocation = cacheKeyLocation || data.location;

  showResults();

  // Refresh cached locations list if this was a new (non-cached) fetch
  if (!data.cached) {
    fetchCachedLocations().then(setCachedLocations);
  }
}

