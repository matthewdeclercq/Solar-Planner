/**
 * Alpine.js store state types
 */

import { LocationDataResponse } from './data';
import { AutocompleteSuggestion } from './api';

export type Theme = 'light' | 'dark';

export type { LocationDataResponse, AutocompleteSuggestion };

export interface AppState {
  // Authentication
  isAuthenticated: boolean;
  token: string | null;
  tokenExpiry: number | null;

  // UI State
  theme: Theme;
  isLoading: boolean;
  error: string | null;
  showResults: boolean;

  // Location & Data
  currentLocation: string | null;
  locationData: LocationDataResponse | null;

  // Autocomplete
  autocompleteSuggestions: AutocompleteSuggestion[];
  cachedLocations: AutocompleteSuggestion[];

  // Power Generation
  panelWattage: number | null;
  powerGenViewMode: 'daily' | 'monthly';
}
