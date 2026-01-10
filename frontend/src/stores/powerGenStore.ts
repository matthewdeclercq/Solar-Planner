/**
 * Power generation store
 * Manages power generation settings
 */

import Alpine from 'alpinejs';

export interface PowerGenStore {
  [key: string]: unknown;
  panelWattage: number | null;
  powerGenViewMode: 'daily' | 'monthly';
  setPanelWattage(wattage: number | null): void;
  setPowerGenViewMode(mode: 'daily' | 'monthly'): void;
}

/**
 * Initialize the power generation store
 */
export function initPowerGenStore(): void {
  Alpine.store('powerGen', {
    panelWattage: null as number | null,
    powerGenViewMode: 'daily' as 'daily' | 'monthly',

    setPanelWattage(wattage: number | null): void {
      this.panelWattage = wattage;
    },

    setPowerGenViewMode(mode: 'daily' | 'monthly'): void {
      this.powerGenViewMode = mode;
    },
  } as PowerGenStore);
}
