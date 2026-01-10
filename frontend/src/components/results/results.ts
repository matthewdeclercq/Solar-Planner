/**
 * Results component
 * Handles data fetching and display
 */

import { fetchLocationData, fetchCachedLocations, clearCache } from '@services/apiService';
import { handleSolarGraphToggle } from '@services/viewToggleService';
import { renderWeatherChart, renderSolarChart, renderSolarTiltChart } from '@components/charts';
import { renderWeatherTable, renderSolarTable } from '@components/tables';
import { initPowerGenCalculator } from '@components/powergen';
import { handleError } from '@services/errorHandlerService';
import type { LocationDataResponse } from '../../types/data';
import Alpine from 'alpinejs';

// Store current API location for cache clearing
let currentApiLocation: string | null = null;
let currentDisplayLocation: string | null = null;

export function initResultsComponent(): void {
  // Listen for fetch-location-data events
  document.addEventListener('fetch-location-data', async (e: Event) => {
    const customEvent = e as CustomEvent<{ apiLocation: string; location: string }>;
    const { apiLocation, location } = customEvent.detail;

    currentApiLocation = apiLocation;
    currentDisplayLocation = location;

    await handleFetchData(apiLocation, location);
  });

  // Set up clear cache button click handler using event delegation
  document.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.id === 'clear-cache-btn' 
      ? target as HTMLButtonElement 
      : target.closest('#clear-cache-btn') as HTMLButtonElement;
    
    if (button && button.id === 'clear-cache-btn') {
      handleClearCacheClick(e, button);
    }
  });
}

async function handleFetchData(apiLocation: string, _displayLocation: string): Promise<void> {
  const uiStore = Alpine.store('ui') as {
    setLoading?: (loading: boolean) => void;
    setError?: (error: string | null) => void;
  };
  const dataStore = Alpine.store('data') as {
    setLocationData?: (data: LocationDataResponse | null) => void;
    setCachedLocations?: (locations: any[]) => void;
  };

  // Show loading
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const resultsEl = document.getElementById('results');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');

  if (uiStore?.setLoading) uiStore.setLoading(true);
  if (uiStore?.setError) uiStore.setError(null);

  try {
    // Fetch data
    const data = await fetchLocationData(apiLocation);

    // Update data store
    if (dataStore?.setLocationData) dataStore.setLocationData(data);

    // Display results
    displayResults(data);

    // Hide loading
    if (loadingEl) loadingEl.classList.add('hidden');
    if (uiStore?.setLoading) uiStore.setLoading(false);

    // Refresh cached locations if this was a new fetch
    if (!data.cached) {
      const cachedLocations = await fetchCachedLocations();
      if (dataStore?.setCachedLocations) {
        dataStore.setCachedLocations(
          cachedLocations.locations.map(
            (loc: {
              location: string;
              originalSearch: string;
              latitude: number;
              longitude: number;
            }) => ({
              display: loc.location,
              value: loc.location,
              apiLocation: loc.originalSearch || `${loc.latitude},${loc.longitude}`,
              lat: loc.latitude,
              lon: loc.longitude,
            })
          )
        );
      }
    }
  } catch (error) {
    // Hide loading
    if (loadingEl) loadingEl.classList.add('hidden');
    if (uiStore?.setLoading) uiStore.setLoading(false);

    // Handle error with context
    handleError(error, {
      component: 'results',
      action: 'handleFetchData',
    });

    // Show error element
    if (errorEl) {
      const errorText = errorEl.querySelector('#error-text');
      const uiStoreError = (uiStore as { error?: string | null })?.error;
      if (errorText && uiStoreError) {
        errorText.textContent = uiStoreError;
      }
      errorEl.classList.remove('hidden');
    }
  }
}

function displayResults(data: LocationDataResponse): void {
  // Update location info
  const resolvedLocationEl = document.getElementById('resolved-location');
  const coordinatesEl = document.getElementById('coordinates');
  const yearsInfoEl = document.getElementById('years-info');
  const cacheInfoEl = document.getElementById('cache-info');
  const cacheInfoText = document.getElementById('cache-info-text');
  const clearCacheBtn = document.getElementById('clear-cache-btn');

  if (resolvedLocationEl) resolvedLocationEl.textContent = data.location;
  if (coordinatesEl) coordinatesEl.textContent = `${data.latitude}°, ${data.longitude}°`;

  const years = data.yearsOfData || 2;
  if (yearsInfoEl) {
    yearsInfoEl.textContent = `Averaging ${years} ${years === 1 ? 'year' : 'years'} of historical data`;
  }

  // Show cache status
  if (data.cached) {
    if (cacheInfoText) cacheInfoText.textContent = '✓ Loaded from cache';
    if (cacheInfoEl) cacheInfoEl.classList.add('cached');
    if (clearCacheBtn) clearCacheBtn.classList.add('show');
  } else {
    if (cacheInfoText) cacheInfoText.textContent = 'Fresh data fetched';
    if (cacheInfoEl) cacheInfoEl.classList.remove('cached');
    if (clearCacheBtn) clearCacheBtn.classList.remove('show');
  }

  // Render tables
  renderWeatherTable(data.weather);
  renderSolarTable(data.solar);

  // Render charts
  renderWeatherChart(data.weather);
  renderSolarChart(data.solar);
  renderSolarTiltChart(data.solar);

  // Initialize power generation calculator
  initPowerGenCalculator(data.solar, data.latitude);

  // Show solar graph toggle if solar section is in graph view (default state)
  const solarGraphView = document.querySelector(
    '[data-section="solar"][data-view="graph"].view-content'
  );
  const solarGraphToggle = document.getElementById('solar-graph-toggle');
  if (solarGraphView && !solarGraphView.classList.contains('hidden')) {
    if (solarGraphToggle) (solarGraphToggle as HTMLElement).style.display = 'flex';
    // Ensure correct label is shown (PSH is default)
    handleSolarGraphToggle('psh');
  }

  // Handle power-gen toggle visibility
  const powerGenGraphView = document.querySelector(
    '[data-section="power-gen"][data-view="graph"].view-content'
  );
  const powerGenViewToggle = document.getElementById('power-gen-view-toggle');
  if (powerGenViewToggle) {
    if (powerGenGraphView && !powerGenGraphView.classList.contains('hidden')) {
      (powerGenViewToggle as HTMLElement).style.display = 'flex';
    } else {
      (powerGenViewToggle as HTMLElement).style.display = 'none';
    }
  }

  // Show results
  const resultsEl = document.getElementById('results');
  if (resultsEl) resultsEl.classList.remove('hidden');

  // Store location for cache clearing
  if (clearCacheBtn) {
    clearCacheBtn.dataset.currentLocation = data.location;
  }
}

async function handleClearCacheClick(e: Event, button: HTMLButtonElement): Promise<void> {
  e.preventDefault();
  e.stopPropagation();

  const location = button.dataset.currentLocation;

  if (!location) {
    handleError(new Error('No location specified for cache clearing'), {
      component: 'results',
      action: 'handleClearCacheClick',
    });
    return;
  }

  // Disable button during operation
  button.disabled = true;
  const originalText = button.textContent;
  if (button.textContent !== null) {
    button.textContent = 'Clearing...';
  }

  try {
    // Clear cache for this location
    await clearCache(location);

    // Refresh cached locations list
    const dataStore = Alpine.store('data') as {
      setCachedLocations?: (locations: any[]) => void;
    };
    const cachedLocations = await fetchCachedLocations();
    if (dataStore?.setCachedLocations) {
      dataStore.setCachedLocations(
        cachedLocations.locations.map(
          (loc: {
            location: string;
            originalSearch: string;
            latitude: number;
            longitude: number;
          }) => ({
            display: loc.location,
            value: loc.location,
            apiLocation: loc.originalSearch || `${loc.latitude},${loc.longitude}`,
            lat: loc.latitude,
            lon: loc.longitude,
          })
        )
      );
    }

    // Refetch data if we have the API location stored
    if (currentApiLocation && currentDisplayLocation) {
      await handleFetchData(currentApiLocation, currentDisplayLocation);
    }
  } catch (error) {
    handleError(error, {
      component: 'results',
      action: 'handleClearCacheClick',
    });
  } finally {
    // Re-enable button
    button.disabled = false;
    if (originalText !== null) {
      button.textContent = originalText;
    }
  }
}
