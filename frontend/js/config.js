/**
 * Configuration constants
 */

// API endpoints - automatically detect local vs production
export const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE = isLocalDev ? 'http://localhost:8787' : 'https://solar-planner-api.matthew-declercq.workers.dev';
export const API_URL = `${API_BASE}/api/data`;
export const LOGIN_URL = `${API_BASE}/api/login`;
export const CACHE_CLEAR_URL = `${API_BASE}/api/cache/clear`;
export const CACHE_LIST_URL = `${API_BASE}/api/cache/list`;

// Storage keys
export const TOKEN_STORAGE_KEY = 'solar_planner_token';
export const TOKEN_EXPIRY_KEY = 'solar_planner_token_expiry';

// Chart configuration
export const Y_AXIS_PADDING_FACTOR = 1.1; // 10% increase (multiplier) for chart Y-axis
export const CHART_RESIZE_DEBOUNCE_MS = 100;

// Autocomplete configuration
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;

// Power generation configuration
export const POWER_ROUNDING_DECIMALS = 2;

