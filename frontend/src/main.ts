/**
 * Main application entry point
 * Initializes Alpine.js and sets up the application
 */

import Alpine from 'alpinejs';
import { initStores } from '@stores/index';
import { initTheme } from '@services/themeService';
import { isAuthenticated } from '@services/authService';
import { loginFormComponent } from '@components/auth/loginForm';
import { navComponent } from '@components/layout/nav';
import { locationInputComponent } from '@components/search/locationInput';
import { initResultsComponent } from '@components/results/results';
import { initViewToggles } from '@services/viewToggleService';
import { handleUnhandledRejection, handleUncaughtError } from '@services/errorHandlerService';

// Make Alpine available globally for debugging
declare global {
  interface Window {
    Alpine: typeof Alpine;
  }
}

// Set up global error handlers
window.addEventListener('unhandledrejection', handleUnhandledRejection);
window.addEventListener('error', handleUncaughtError);

// Initialize theme first (before Alpine)
initTheme();

// Initialize Alpine.js stores
initStores();

// Register Alpine.js components
Alpine.data('loginForm', loginFormComponent);
Alpine.data('nav', navComponent);
Alpine.data('locationInput', locationInputComponent);

// Initialize results component (handles data fetching and display)
initResultsComponent();

/**
 * Toggle between login page and main app based on authentication state
 * Exported for use by other modules (e.g., after login or auth errors)
 */
export function toggleAppView(): void {
  const isAuth = isAuthenticated();
  const loginPage = document.getElementById('login-page');
  const mainApp = document.getElementById('main-app');
  
  if (!isAuth) {
    // Show login page
    if (loginPage) loginPage.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
  } else {
    // Show main app
    if (loginPage) loginPage.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    
    // Initialize main app components
    initMainApp();
  }
}

// Initialize app state
function initApp() {
  toggleAppView();
}

function initMainApp() {
  // Check for location in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const location = urlParams.get('location');
  if (location) {
    const locationInput = document.getElementById('location-input') as HTMLInputElement;
    if (locationInput) {
      locationInput.value = location;
      const apiLocation = locationInput.dataset.apiLocation || location;
      const event = new CustomEvent('fetch-location-data', { 
        detail: { apiLocation, location } 
      });
      document.dispatchEvent(event);
    }
  }
}

// Start Alpine.js after DOM is ready
async function startApp() {
  // Initialize view toggles (needs to be after DOM is ready)
  await initViewToggles();
  
  Alpine.start();
  initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// Make Alpine available globally for debugging
window.Alpine = Alpine;
