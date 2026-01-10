/**
 * API request and response types
 */

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  expiresIn: number;
}

export interface DataRequest {
  location: string;
  lat?: number;
  lon?: number;
}

export interface AutocompleteSuggestion {
  display: string;
  value: string;
  apiLocation: string;
  lat: number;
  lon: number;
}

export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[];
}

export interface CacheClearRequest {
  location?: string;
}

export interface CacheClearResponse {
  success: boolean;
  message: string;
  deletedCount: number;
}

export interface CachedLocation {
  key: string;
  location: string;
  originalSearch: string;
  latitude: number;
  longitude: number;
  cachedAt: number;
}

export interface CacheListResponse {
  locations: CachedLocation[];
}
