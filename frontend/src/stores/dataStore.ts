/**
 * Data store
 * Manages location data and autocomplete
 */

import Alpine from 'alpinejs';
import type { LocationDataResponse, AutocompleteSuggestion } from '../types/store';

export interface DataStore {
  [key: string]: unknown;
  currentLocation: string | null;
  locationData: LocationDataResponse | null;
  autocompleteSuggestions: AutocompleteSuggestion[];
  cachedLocations: AutocompleteSuggestion[];
  cacheLoadingStatus: 'idle' | 'loading' | 'loaded';
  cacheLoadPromise: Promise<void> | null;
  setLocationData(data: LocationDataResponse | null): void;
  setAutocompleteSuggestions(suggestions: AutocompleteSuggestion[]): void;
  setCachedLocations(locations: AutocompleteSuggestion[]): void;
}

/**
 * Initialize the data store
 */
export function initDataStore(): void {
  Alpine.store('data', {
    currentLocation: null as string | null,
    locationData: null as LocationDataResponse | null,
    autocompleteSuggestions: [] as AutocompleteSuggestion[],
    cachedLocations: [] as AutocompleteSuggestion[],
    cacheLoadingStatus: 'idle' as 'idle' | 'loading' | 'loaded',
    cacheLoadPromise: null as Promise<void> | null,

    setLocationData(data: LocationDataResponse | null): void {
      this.locationData = data;
      if (data) {
        this.currentLocation = data.location;
        // Update UI store to show results
        const uiStore = Alpine.store('ui') as { setShowResults?: (show: boolean) => void };
        if (uiStore?.setShowResults) {
          uiStore.setShowResults(true);
        }
      } else {
        this.currentLocation = null;
        const uiStore = Alpine.store('ui') as { setShowResults?: (show: boolean) => void };
        if (uiStore?.setShowResults) {
          uiStore.setShowResults(false);
        }
      }
    },

    setAutocompleteSuggestions(suggestions: AutocompleteSuggestion[]): void {
      this.autocompleteSuggestions = suggestions;
    },

    setCachedLocations(locations: AutocompleteSuggestion[]): void {
      this.cachedLocations = locations;
    },
  } as DataStore);
}
