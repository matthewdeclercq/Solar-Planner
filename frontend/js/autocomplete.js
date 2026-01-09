/**
 * Autocomplete module
 */

import { API_BASE, isLocalDev, AUTOCOMPLETE_DEBOUNCE_MS } from './config.js';
import { locationInput, autocompleteDropdown, solarGraphToggle, solarPshLabel, solarTiltLabel, solarChartEl, solarTiltChartEl, querySelectorAll, getElement, hourlyPowerContainer } from './dom.js';
import { getAuthToken, getAuthHeaders, handleAuthError } from './auth.js';
import { handleApiResponse, fetchData } from './api.js';
import { escapeHtml } from './utils.js';
import { debounceChartResize, getWeatherChart, getSolarChart, getSolarTiltChart } from './charts.js';
import { getPowerGenChart, showMonthlyChart } from './powergen.js';

// SVG icon constants
const ICON_CACHED = '<svg class="autocomplete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICON_LOCATION = '<svg class="autocomplete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

// Autocomplete state
let autocompleteSuggestions = [];
let selectedIndex = -1;
let autocompleteTimeout = null;
let autocompleteRequestId = 0; // Track request sequence for race condition protection
let cachedLocations = []; // Store cached locations for history dropdown

/**
 * Set cached locations for history dropdown
 * @param {Array} locations - Array of cached location objects
 */
export function setCachedLocations(locations) {
  cachedLocations = locations || [];
}

/**
 * Hide autocomplete dropdown
 */
export function hideAutocomplete() {
  autocompleteDropdown.classList.add('hidden');
  autocompleteSuggestions = [];
  selectedIndex = -1;
}

/**
 * Show cached locations dropdown (when input is focused and empty)
 */
function showCachedLocations() {
  if (cachedLocations.length === 0) return;

  autocompleteSuggestions = cachedLocations
    .filter(loc => loc.location) // Only show items with valid location names
    .map(loc => ({
      display: loc.location,
      value: loc.location,
      // Use originalSearch to ensure cache key matches (guarantees cache hit)
      apiLocation: loc.originalSearch || `${loc.latitude},${loc.longitude}`,
      isCached: true
    }));
  selectedIndex = -1;
  renderAutocomplete('Recent Searches');
}

/**
 * Render autocomplete dropdown
 * @param {string} header - Optional header text (e.g., "Recent Searches")
 */
function renderAutocomplete(header = null) {
  if (autocompleteSuggestions.length === 0) {
    hideAutocomplete();
    return;
  }

  const headerHtml = header
    ? `<div class="autocomplete-header">${escapeHtml(header)}</div>`
    : '';

  autocompleteDropdown.innerHTML = headerHtml + autocompleteSuggestions
    .map((suggestion, index) => {
      const icon = suggestion.isCached ? ICON_CACHED : ICON_LOCATION;
      return `<div class="autocomplete-item" data-index="${index}">${icon}${escapeHtml(suggestion.display)}</div>`;
    })
    .join('');

  // Use event delegation instead of adding listeners to each item (prevents memory leak)
  autocompleteDropdown.classList.remove('hidden');
}

/**
 * Update selected item in autocomplete
 */
function updateAutocompleteSelection() {
  const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * Select an autocomplete suggestion
 * @param {Object} suggestion - Selected suggestion object
 */
function selectAutocomplete(suggestion) {
  // Store display value and API-compatible location
  const displayLocation = suggestion.display || suggestion.value;
  locationInput.value = displayLocation;
  // Store API location in data attribute (coordinates preferred)
  locationInput.dataset.apiLocation = suggestion.apiLocation || suggestion.value;
  hideAutocomplete();

  // Auto-fetch if this is a cached location (instant load)
  if (suggestion.isCached) {
    // Update URL with display location (same as handleSubmit)
    const url = new URL(window.location);
    url.searchParams.set('location', displayLocation);
    window.history.pushState({}, '', url.toString());
    
    fetchData(suggestion.apiLocation);
  } else {
    locationInput.focus();
  }
}

/**
 * Fetch autocomplete suggestions
 * @param {string} query - Search query
 */
async function fetchAutocomplete(query) {
  const token = getAuthToken();
  if (!token) return;

  // Increment request ID to track sequence (race condition protection)
  const currentRequestId = ++autocompleteRequestId;

  try {
    const response = await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(token)
    });

    // Check if this is still the latest request (prevent race condition)
    if (currentRequestId !== autocompleteRequestId) {
      return; // Ignore outdated response
    }

    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      return;
    }

    const data = await handleApiResponse(response);
    if (!data) return; // Auth error handled

    // Double-check request is still current
    if (currentRequestId !== autocompleteRequestId) {
      return; // Ignore outdated response
    }

    autocompleteSuggestions = data.suggestions || [];
    selectedIndex = -1;
    renderAutocomplete();
  } catch (error) {
    // Only process if this is still the latest request
    if (currentRequestId === autocompleteRequestId) {
      if (isLocalDev) {
        console.error('Autocomplete error:', error);
      }
      hideAutocomplete();
    }
  }
}

/**
 * Setup autocomplete functionality
 */
export function setupAutocomplete() {
  let isComposing = false; // Track IME composition (for Asian languages)

  // Show cached locations when input is focused and empty
  locationInput.addEventListener('focus', () => {
    const query = locationInput.value.trim();
    if (query.length === 0) {
      showCachedLocations();
    }
  });

  locationInput.addEventListener('input', (e) => {
    if (isComposing) return;
    const query = e.target.value.trim();

    // Clear API location when user types manually (not from autocomplete selection)
    delete locationInput.dataset.apiLocation;

    // Clear previous timeout
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }

    // Show cached locations if input is empty
    if (query.length === 0) {
      showCachedLocations();
      return;
    }

    // Hide dropdown if query is too short for API search
    if (query.length < 2) {
      hideAutocomplete();
      return;
    }

    // Debounce autocomplete requests
    autocompleteTimeout = setTimeout(() => {
      fetchAutocomplete(query);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  });

  // Handle IME composition events
  locationInput.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  
  locationInput.addEventListener('compositionend', () => {
    isComposing = false;
    const query = locationInput.value.trim();
    if (query.length >= 2) {
      fetchAutocomplete(query);
    }
  });

  // Handle keyboard navigation
  locationInput.addEventListener('keydown', (e) => {
    if (autocompleteDropdown.classList.contains('hidden')) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, autocompleteSuggestions.length - 1);
        updateAutocompleteSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateAutocompleteSelection();
        break;
      case 'Enter':
        if (selectedIndex >= 0 && autocompleteSuggestions[selectedIndex]) {
          e.preventDefault();
          selectAutocomplete(autocompleteSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        hideAutocomplete();
        break;
    }
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!locationInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      hideAutocomplete();
    }
  });

  // Use event delegation for autocomplete item clicks (prevents memory leak)
  autocompleteDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      if (!isNaN(index) && autocompleteSuggestions[index]) {
        selectAutocomplete(autocompleteSuggestions[index]);
      }
    }
  });
}

/**
 * Handle solar graph toggle (PSH vs Tilt Angle)
 * @param {string} view - View type ('psh' or 'tilt')
 */
export function handleSolarGraphToggle(view) {
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
 * @returns {string} 'psh' or 'tilt'
 */
function getActiveSolarGraph() {
  if (!solarGraphToggle) return 'psh';
  const activeToggle = solarGraphToggle.querySelector('.toggle-btn.active');
  return activeToggle?.dataset?.view || 'psh';
}

/**
 * Show correct solar label based on active graph
 * @param {HTMLElement} labelElement - Label element to show/hide
 */
function showCorrectSolarLabel(labelElement) {
  const activeGraph = getActiveSolarGraph();

  if (labelElement === solarPshLabel) {
    labelElement.classList.toggle('hidden', activeGraph !== 'psh');
  } else if (labelElement === solarTiltLabel) {
    labelElement.classList.toggle('hidden', activeGraph !== 'tilt');
  }
}

/**
 * Handle chart resize when activating graph view
 * @param {string} section - Section name ('weather', 'solar', or 'power-gen')
 */
function handleGraphViewActivation(section) {
  if (section === 'weather') {
    debounceChartResize(getWeatherChart());
  } else if (section === 'solar') {
    if (solarGraphToggle) solarGraphToggle.style.display = 'flex';
    debounceChartResize(getSolarChart());
  } else if (section === 'power-gen') {
    const powerGenViewToggle = getElement('power-gen-view-toggle');
    if (powerGenViewToggle) powerGenViewToggle.style.display = 'flex';
    debounceChartResize(getPowerGenChart());
  }
}

/**
 * Handle section view toggle (table vs graph)
 * @param {string} section - Section name ('weather', 'solar', or 'power-gen')
 * @param {string} view - View type ('table' or 'graph')
 */
export function handleSectionViewToggle(section, view) {
  const sectionContents = querySelectorAll(`[data-section="${section}"].view-content`);

  sectionContents.forEach(content => {
    const isTargetView = content.dataset.view === view;

    if (section === 'solar' && view === 'graph' &&
        (content === solarPshLabel || content === solarTiltLabel)) {
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
    const powerGenViewToggle = getElement('power-gen-view-toggle');
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

