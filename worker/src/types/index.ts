/**
 * Type definitions for Cloudflare Worker
 */

export interface Env {
  SOLAR_CACHE: KVNamespace;
  VISUAL_CROSSING_API_KEY: string;
  SITE_PASSWORD: string;
  YEARS_OF_DATA?: string;
  CACHE_TTL?: string;
}

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

export interface WeatherData {
  month: string;
  highF: number;
  lowF: number;
  meanF: number;
  humidity: number;
}

export interface SolarTiltData {
  tilt: string;
  psh: number;
}

export interface SolarMonthData {
  month: string;
  monthlyOptimal: SolarTiltData;
  yearlyFixed: SolarTiltData;
  flat: SolarTiltData;
}

export interface LocationDataResponse {
  location: string;
  latitude: number;
  longitude: number;
  weather: WeatherData[];
  solar: SolarMonthData[];
  yearsOfData: number;
  cached?: boolean;
  cachedAt?: number;
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

export interface CacheClearRequest {
  location?: string;
}

export interface CacheClearResponse {
  success: boolean;
  message: string;
  deletedCount: number;
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

export interface VisualCrossingDay {
  datetime: string;
  tempmax: number;
  tempmin: number;
  temp: number;
  humidity: number;
  solarenergy: number;
}

export interface VisualCrossingResponse {
  latitude: number;
  longitude: number;
  resolvedAddress: string;
  days: VisualCrossingDay[];
}
