/**
 * Solar Planner - Main Application
 * 
 * Orchestrates all modules and initializes the application
 */

import { isAuthenticated } from './auth.js';
import { showLoginPage, showMainApp } from './ui.js';
import { setupLoginForm } from './login.js';
import { searchForm, locationInput, querySelectorAll } from './dom.js';
import { setupAutocomplete, hideAutocomplete, handleSolarGraphToggle, handleSectionViewToggle } from './autocomplete.js';
import { setupClearCache } from './cache.js';
import { fetchData } from './api.js';
import { getUrlParam } from './utils.js';
import { destroyAllCharts } from './charts.js';
import { showError } from './ui.js';

// Cleanup function to clear timeouts on page unload
function cleanup() {
  destroyAllCharts();
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
  
  // Use API-compatible location if available (coordinates preferred), otherwise use input value
  const apiLocation = locationInput.dataset.apiLocation || location;
  
  // Update URL with display location
  const url = new URL(window.location);
  url.searchParams.set('location', location);
  window.history.pushState({}, '', url.toString());
  
  await fetchData(apiLocation);
}

/**
 * Setup view toggle functionality
 */
function setupViewToggles() {
  const toggleButtons = querySelectorAll('.toggle-btn');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      const view = button.dataset.view;
      
      // Update button states
      const sectionButtons = querySelectorAll(`[data-section="${section}"].toggle-btn`);
      sectionButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Handle solar graph toggle (PSH vs Tilt Angle)
      if (section === 'solar-graph') {
        handleSolarGraphToggle(view);
        return;
      }
      
      // Handle section view toggle (table vs graph)
      handleSectionViewToggle(section, view);
    });
  });
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
  setupViewToggles();
  setupClearCache();
  
  // Check for location in URL params
  const location = getUrlParam('location');
  if (location) {
    locationInput.value = location;
    const apiLocation = locationInput.dataset.apiLocation || location;
    fetchData(apiLocation);
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

