/**
 * Solar Planner - Frontend Application
 * 
 * Handles user input, API calls, table rendering, and Chart.js graphs.
 */

// API endpoints - automatically detect local vs production
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalDev ? 'http://localhost:8787' : '';
const API_URL = `${API_BASE}/api/data`;
const LOGIN_URL = `${API_BASE}/api/login`;
const TOKEN_STORAGE_KEY = 'solar_planner_token';
const TOKEN_EXPIRY_KEY = 'solar_planner_token_expiry';

// DOM Elements
const loginPage = document.getElementById('login-page');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const loginErrorText = document.getElementById('login-error-text');
const searchForm = document.getElementById('search-form');
const locationInput = document.getElementById('location-input');
const submitBtn = document.getElementById('submit-btn');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorText = document.getElementById('error-text');
const resultsEl = document.getElementById('results');
const resolvedLocationEl = document.getElementById('resolved-location');
const coordinatesEl = document.getElementById('coordinates');
const weatherTableBody = document.querySelector('#weather-table tbody');
const solarTableBody = document.querySelector('#solar-table tbody');
const cacheInfoEl = document.getElementById('cache-info');

// Chart instances
let weatherChart = null;
let solarChart = null;

// Chart.js default configuration
Chart.defaults.font.family = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.color = '#8DA4BE';
Chart.defaults.borderColor = 'rgba(141, 164, 190, 0.15)';

// Shared chart configuration
const CHART_COMMON_OPTIONS = {
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
const createYAxis = (title, position = 'left', min = null, max = null) => ({
  type: 'linear',
  display: true,
  position,
  title: { display: true, text: title },
  min,
  max,
  grid: position === 'left' 
    ? { color: 'rgba(141, 164, 190, 0.1)' }
    : { drawOnChartArea: false }
});

// Helper to convert hex color to rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper to create line dataset
function createLineDataset(label, data, color, options = {}) {
  const bgColor = color.startsWith('#') ? hexToRgba(color, 0.1) : color.replace(')', ', 0.1)');
  
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: bgColor,
    borderWidth: options.borderWidth || 2,
    tension: 0.3,
    pointRadius: options.pointRadius || 4,
    pointHoverRadius: options.pointHoverRadius || 6,
    pointBackgroundColor: color,
    fill: options.fill || false,
    ...options
  };
}

// Helper to create bar dataset
function createBarDataset(label, data, color, yAxisID, order) {
  const bgColor = color.startsWith('#') ? hexToRgba(color, 0.3) : color.replace(')', ', 0.3)');
  
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: bgColor,
    borderWidth: 0,
    type: 'bar',
    yAxisID,
    order
  };
}

/**
 * Initialize the application
 */
function init() {
  // Check authentication first
  if (!isAuthenticated()) {
    showLoginPage();
    setupLoginForm();
    return;
  }

  // User is authenticated, show main app
  showMainApp();
  
  searchForm.addEventListener('submit', handleSubmit);
  setupAutocomplete();
  
  // Check for location in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const location = urlParams.get('location');
  if (location) {
    locationInput.value = location;
    fetchData(location);
  }
}

/**
 * Setup login form event listener
 */
function setupLoginForm() {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    
    loginBtn.disabled = true;
    loginError.classList.add('hidden');
    
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response from server. Please try again.');
      }
      
      // Check if response body is empty
      const text = await response.text();
      if (!text || text.trim() === '') {
        throw new Error('Empty response from server. Please try again.');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        throw new Error('Invalid response from server. Please try again.');
      }
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Store token and expiry
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, data.expiresAt.toString());
      
      // Reload page to show main app
      window.location.reload();
    } catch (error) {
      loginErrorText.textContent = error.message || 'Login failed. Please try again.';
      loginError.classList.remove('hidden');
      loginBtn.disabled = false;
    }
  });
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) {
    return false;
  }
  
  // Check if token has expired
  const expiresAt = parseInt(expiry, 10);
  if (Date.now() >= expiresAt) {
    // Token expired, clear it
    clearAuth();
    return false;
  }
  
  return true;
}

/**
 * Get authentication token
 */
function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Clear authentication
 */
function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Show login page
 */
function showLoginPage() {
  loginPage.classList.remove('hidden');
  mainApp.classList.add('hidden');
}

/**
 * Show main application (hide login)
 */
function showMainApp() {
  loginPage.classList.add('hidden');
  mainApp.classList.remove('hidden');
}

// Autocomplete state
let autocompleteSuggestions = [];
let selectedIndex = -1;
let autocompleteTimeout = null;

/**
 * Setup autocomplete functionality
 */
function setupAutocomplete() {
  let isComposing = false; // Track IME composition (for Asian languages)

  locationInput.addEventListener('input', (e) => {
    if (isComposing) return;
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }
    
    // Hide dropdown if query is too short
    if (query.length < 2) {
      hideAutocomplete();
      return;
    }
    
    // Debounce autocomplete requests
    autocompleteTimeout = setTimeout(() => {
      fetchAutocomplete(query);
    }, 300);
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
}

/**
 * Fetch autocomplete suggestions
 */
async function fetchAutocomplete(query) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
        window.location.reload();
        return;
      }
      return;
    }

    const data = await response.json();
    autocompleteSuggestions = data.suggestions || [];
    selectedIndex = -1;
    renderAutocomplete();
  } catch (error) {
    console.error('Autocomplete error:', error);
    hideAutocomplete();
  }
}

/**
 * Render autocomplete dropdown
 */
function renderAutocomplete() {
  if (autocompleteSuggestions.length === 0) {
    hideAutocomplete();
    return;
  }

  autocompleteDropdown.innerHTML = autocompleteSuggestions
    .map((suggestion, index) => 
      `<div class="autocomplete-item" data-index="${index}">${escapeHtml(suggestion.display)}</div>`
    )
    .join('');

  // Add click handlers
  autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      selectAutocomplete(autocompleteSuggestions[index]);
    });
  });

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
 */
function selectAutocomplete(suggestion) {
  locationInput.value = suggestion.value;
  hideAutocomplete();
  locationInput.focus();
}

/**
 * Hide autocomplete dropdown
 */
function hideAutocomplete() {
  autocompleteDropdown.classList.add('hidden');
  autocompleteSuggestions = [];
  selectedIndex = -1;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  hideAutocomplete(); // Hide dropdown on submit
  const location = locationInput.value.trim();
  
  if (!location) {
    showError('Please enter a location');
    return;
  }
  
  // Update URL with location
  const url = new URL(window.location);
  url.searchParams.set('location', location);
  window.history.pushState({}, '', url);
  
  await fetchData(location);
}

/**
 * Fetch data from the API
 */
async function fetchData(location) {
  showLoading();
  hideError();
  hideResults();
  
  const token = getAuthToken();
  if (!token) {
    showError('Not authenticated. Please login again.');
    clearAuth();
    setTimeout(() => window.location.reload(), 2000);
    return;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ location })
    });
    
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error('Invalid response from server. Please try again.');
    }
    
    // Handle authentication errors
    if (response.status === 401) {
      clearAuth();
      showError('Session expired. Please login again.');
      setTimeout(() => window.location.reload(), 2000);
      return;
    }
    
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to fetch data');
    }
    
    hideLoading();
    displayResults(data);
    
  } catch (error) {
    hideLoading();
    showError(error.message || 'An error occurred. Please try again.');
    console.error('Fetch error:', error);
  }
}

/**
 * Display the results
 */
function displayResults(data) {
  // Update location info
  resolvedLocationEl.textContent = data.location;
  coordinatesEl.textContent = `${data.latitude}°, ${data.longitude}°`;
  
  // Render tables
  renderWeatherTable(data.weather);
  renderSolarTable(data.solar);
  
  // Render charts
  renderWeatherChart(data.weather);
  renderSolarChart(data.solar);
  
  // Show cache status
  if (data.cached) {
    cacheInfoEl.textContent = '✓ Loaded from cache';
    cacheInfoEl.classList.add('cached');
  } else {
    cacheInfoEl.textContent = 'Fresh data fetched';
    cacheInfoEl.classList.remove('cached');
  }
  
  showResults();
}

/**
 * Render the weather data table
 */
function renderWeatherTable(weather) {
  weatherTableBody.innerHTML = weather.map(row => `
    <tr>
      <td>${row.month}</td>
      <td>${row.highF}</td>
      <td>${row.lowF}</td>
      <td>${row.meanF}</td>
      <td>${row.humidity}</td>
      <td>${row.sunshineHours}</td>
    </tr>
  `).join('');
}

/**
 * Render the solar data table
 */
function renderSolarTable(solar) {
  solarTableBody.innerHTML = solar.map(row => `
    <tr>
      <td>${row.month}</td>
      <td>${row.monthlyOptimal.tilt}°</td>
      <td>${row.monthlyOptimal.psh}</td>
      <td>${row.yearlyFixed.tilt}°</td>
      <td>${row.yearlyFixed.psh}</td>
      <td>${row.flat.psh}</td>
    </tr>
  `).join('');
}

/**
 * Render the weather chart
 */
function renderWeatherChart(weather) {
  const ctx = document.getElementById('weather-chart').getContext('2d');
  
  if (weatherChart) {
    weatherChart.destroy();
  }
  
  const labels = weather.map(w => w.month);
  
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('High (°F)', weather.map(w => w.highF), '#DC2F02', { yAxisID: 'y' }),
        createLineDataset('Mean (°F)', weather.map(w => w.meanF), '#F5A623', { yAxisID: 'y' }),
        createLineDataset('Low (°F)', weather.map(w => w.lowF), '#0096C7', { yAxisID: 'y' }),
        createBarDataset('Humidity (%)', weather.map(w => w.humidity), '#10B981', 'y1', 2),
        createBarDataset('Sunshine (hrs)', weather.map(w => w.sunshineHours), '#FBBF24', 'y2', 1)
      ]
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      scales: {
        ...CHART_COMMON_OPTIONS.scales,
        y: createYAxis('Temperature (°F)'),
        y1: { ...createYAxis('Humidity (%)', 'right', 0, 100), display: true },
        y2: { ...createYAxis('Sunshine (hrs)', 'right', 0, 16), display: false }
      }
    }
  });
}

/**
 * Render the solar PSH chart
 */
function renderSolarChart(solar) {
  const ctx = document.getElementById('solar-chart').getContext('2d');
  
  if (solarChart) {
    solarChart.destroy();
  }
  
  const labels = solar.map(s => s.month);
  
  solarChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        createLineDataset('Monthly Optimal Tilt', solar.map(s => s.monthlyOptimal.psh), '#F5A623', {
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true
        }),
        createLineDataset('Yearly Fixed Tilt', solar.map(s => s.yearlyFixed.psh), '#0096C7'),
        createLineDataset('Flat (0°)', solar.map(s => s.flat.psh), '#8DA4BE', {
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
        y: createYAxis('Peak Sun Hours (kWh/m²/day)', 'left', 0)
      }
    }
  });
}

/**
 * UI State Helpers
 */
function showLoading() {
  loadingEl.classList.remove('hidden');
  submitBtn.disabled = true;
}

function hideLoading() {
  loadingEl.classList.add('hidden');
  submitBtn.disabled = false;
}

function showError(message) {
  errorText.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function showResults() {
  resultsEl.classList.remove('hidden');
}

function hideResults() {
  resultsEl.classList.add('hidden');
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

