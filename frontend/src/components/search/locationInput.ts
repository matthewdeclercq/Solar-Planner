/**
 * Location input with autocomplete component
 */

import Alpine from 'alpinejs';
import { fetchAutocomplete, fetchCachedLocations } from '@services/apiService';
import { AUTOCOMPLETE_DEBOUNCE_MS } from '@services/configService';
import { logger } from '@services/loggerService';
import { escapeHtml } from '@utils/index';

const ICON_CACHED =
  '<svg class="autocomplete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICON_LOCATION =
  '<svg class="autocomplete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

export function locationInputComponent() {
  return {
    query: '',
    selectedApiLocation: '',
    suggestions: [] as Array<{
      display: string;
      value: string;
      apiLocation: string;
      isCached?: boolean;
    }>,
    selectedIndex: -1,
    showDropdown: false,
    header: '',
    debounceTimer: null as number | null,

    init() {
      // Load cached locations on init
      this.loadCachedLocations();
    },

    async loadCachedLocations() {
      try {
        const response = await fetchCachedLocations();
        const dataStore = Alpine.store('data') as {
          setCachedLocations?: (locations: unknown[]) => void;
        };
        if (dataStore?.setCachedLocations) {
          dataStore.setCachedLocations(
            response.locations.map((loc) => ({
              display: loc.location,
              value: loc.location,
              apiLocation: loc.originalSearch || `${loc.latitude},${loc.longitude}`,
              lat: loc.latitude,
              lon: loc.longitude,
            }))
          );
        }
      } catch (error) {
        logger.error('Failed to load cached locations', error);
        // Silently fail - cached locations are not critical for app functionality
      }
    },

    async search() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(async () => {
        if (!this.query.trim()) {
          this.showCachedLocations();
          return;
        }

        if (this.query.length < 2) {
          this.suggestions = [];
          this.showDropdown = false;
          return;
        }

        try {
          const response = await fetchAutocomplete(this.query);
          this.suggestions = response.suggestions;
          this.selectedIndex = -1;
          this.header = '';
          this.showDropdown = this.suggestions.length > 0;
        } catch (error) {
          logger.error('Autocomplete error', error);
          this.suggestions = [];
          this.showDropdown = false;
          // Silently fail - autocomplete is not critical, user can still type location
        }
      }, AUTOCOMPLETE_DEBOUNCE_MS);
    },

    showCachedLocations() {
      const dataStore = Alpine.store('data') as { cachedLocations?: unknown[] };
      const cached = (dataStore?.cachedLocations || []) as Array<{
        display: string;
        value: string;
        apiLocation: string;
      }>;

      if (cached.length === 0) {
        this.suggestions = [];
        this.showDropdown = false;
        return;
      }

      this.suggestions = cached.map(
        (loc: { display: string; value: string; apiLocation: string }) => ({
          ...loc,
          isCached: true,
        })
      );
      this.selectedIndex = -1;
      this.header = 'Recent Searches';
      this.showDropdown = true;
    },

    selectSuggestion(suggestion: { display: string; apiLocation: string }) {
      this.query = suggestion.display;
      this.selectedApiLocation = suggestion.apiLocation;
      this.showDropdown = false;
      this.selectedIndex = -1;

      // Store API location in input dataset for form submission
      const input = document.getElementById('location-input') as HTMLInputElement;
      if (input) {
        input.dataset.apiLocation = suggestion.apiLocation;
      }
    },

    handleKeydown(event: KeyboardEvent) {
      if (!this.showDropdown || this.suggestions.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
          break;
        case 'Enter':
          event.preventDefault();
          if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
            this.selectSuggestion(this.suggestions[this.selectedIndex]);
          }
          break;
        case 'Escape':
          this.showDropdown = false;
          this.selectedIndex = -1;
          break;
      }
    },

    get suggestionItems() {
      return this.suggestions.map((suggestion, index) => ({
        ...suggestion,
        icon: suggestion.isCached ? ICON_CACHED : ICON_LOCATION,
        isSelected: index === this.selectedIndex,
        displayEscaped: escapeHtml(suggestion.display),
      }));
    },

    handleSubmit() {
      const location = this.query.trim();
      if (!location) return;

      const apiLocation = this.selectedApiLocation || location;
      const input = document.getElementById('location-input') as HTMLInputElement;
      if (input) {
        input.dataset.apiLocation = apiLocation;
      }

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('location', location);
      window.history.pushState({}, '', url.toString());

      // Dispatch custom event to trigger data fetch
      document.dispatchEvent(
        new CustomEvent('fetch-location-data', {
          detail: { apiLocation, location },
        })
      );
    },
  };
}
