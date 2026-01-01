/**
 * UI state management module
 */

import { loadingEl, errorEl, errorText, resultsEl, submitBtn } from './dom.js';

/**
 * Show loading state
 */
export function showLoading() {
  loadingEl.classList.remove('hidden');
  submitBtn.disabled = true;
}

/**
 * Hide loading state
 */
export function hideLoading() {
  loadingEl.classList.add('hidden');
  submitBtn.disabled = false;
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
export function showError(message) {
  errorText.textContent = message;
  errorEl.classList.remove('hidden');
}

/**
 * Hide error message
 */
export function hideError() {
  errorEl.classList.add('hidden');
}

/**
 * Show results container
 */
export function showResults() {
  resultsEl.classList.remove('hidden');
}

/**
 * Hide results container
 */
export function hideResults() {
  resultsEl.classList.add('hidden');
}

import { loginPage, mainApp } from './dom.js';

/**
 * Show login page
 */
export function showLoginPage() {
  loginPage.classList.remove('hidden');
  mainApp.classList.add('hidden');
}

/**
 * Show main application (hide login)
 */
export function showMainApp() {
  loginPage.classList.add('hidden');
  mainApp.classList.remove('hidden');
}

