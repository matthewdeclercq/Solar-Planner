# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend
```bash
cd frontend
npm run dev      # Vite dev server on http://localhost:3000
npm run build    # Production build to dist/
```

### Worker (Cloudflare)
```bash
cd worker
npm run dev      # Local dev server on http://localhost:8787
npm run deploy   # Deploy to production
npm run tail     # View production logs
```

### Local Development Setup
Create `worker/.dev.vars` with:
```
SITE_PASSWORD=your-password
VISUAL_CROSSING_API_KEY=your-api-key
```

## Architecture

**Stack**: TypeScript + Vite + Alpine.js frontend + Cloudflare Worker (TypeScript) backend + KV caching

### Frontend (`frontend/`)
TypeScript with Vite build system and Alpine.js for reactive UI.

**Entry Point:**
- `src/main.ts` - Alpine.js initialization, component registration

**Services (`src/services/`):**
- `apiService.ts` - API calls (login, data, autocomplete, cache)
- `authService.ts` - Token management (localStorage)
- `configService.ts` - Environment-based API URL detection, constants
- `domService.ts` - Typed DOM element accessors with caching
- `errorHandlerService.ts` - Error handling and error boundary pattern
- `loggerService.ts` - Centralized logging with log levels (DEBUG/INFO/WARN/ERROR)
- `themeService.ts` - Light/dark theme toggle (persisted)
- `viewToggleService.ts` - Table/graph view toggles, solar graph toggles

**Components (`src/components/`):**
- `auth/loginForm.ts` - Login form component
- `layout/nav.ts` - Navigation with theme toggle
- `search/locationInput.ts` - Location search with autocomplete
- `results/results.ts` - Results display orchestration
- `charts/` - Chart rendering modules:
  - `chartConfig.ts` - Shared chart options and utilities
  - `weatherChart.ts` - Temperature/humidity chart
  - `solarCharts.ts` - PSH and tilt angle charts
  - `index.ts` - Chart module exports
- `tables/` - Table rendering modules:
  - `weatherTable.ts` - Weather data table
  - `solarTable.ts` - Solar data table
  - `powerGenTable.ts` - Power generation table
  - `index.ts` - Table module exports
- `powergen/` - Power generation calculator:
  - `calculator.ts` - Pure calculation functions
  - `charts.ts` - Monthly/hourly power charts
  - `index.ts` - Module exports and event listeners

**Stores (`src/stores/`):**
- `index.ts` - Store initialization orchestrator
- `authStore.ts` - Authentication state and token management
- `dataStore.ts` - Location and weather/solar data state
- `powerGenStore.ts` - Power generation calculator state
- `uiStore.ts` - UI state (theme, view toggles, errors)

**Types (`src/types/`):**
- `index.ts` - Central type exports
- `api.ts` - Request/response interfaces
- `weather.ts` - Weather data types
- `solar.ts` - Solar calculation types
- `powergen.ts` - Power generation types
- `charts.ts` - Chart configuration types
- `store.ts` - Alpine.js store types
- `data.ts` - Combined location data types
- `alpine.d.ts` - Alpine.js TypeScript declarations

**Utilities (`src/utils/`):**
- `index.ts` - URL params, HTML escaping, color conversion
- `chartUtils.ts` - Chart.js defaults and safe destroy
- `chartGlobal.ts` - Chart.js CDN availability check

### Worker (`worker/src/`)
Modular TypeScript architecture:

**Entry Point:**
- `index.ts` - Main router and request handling

**Routes (`routes/`):**
- `data.ts` - `/api/data` endpoint (weather + solar fetch)
- `autocomplete.ts` - `/api/autocomplete` endpoint
- `cache.ts` - `/api/cache/clear` and `/api/cache/list` endpoints

**Services (`services/`):**
- `auth.ts` - HMAC-SHA256 token generation/verification
- `weather.ts` - Visual Crossing API integration
- `solar.ts` - Solar geometry and PSH calculations
- `geocoding.ts` - Nominatim forward/reverse geocoding

**Middleware (`middleware/`):**
- `cors.ts` - CORS header handling

**Utilities (`utils/`):**
- `math.ts` - Average and rounding helpers
- `response.ts` - JSON response formatting
- `cache.ts` - Cache key normalization
- `validation.ts` - Input validation

**Types (`types/`):**
- `index.ts` - All TypeScript interfaces (Env, requests, responses, data)

### API Endpoints
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/login` | POST | No | Get auth token |
| `/api/data` | POST | Bearer | Fetch weather + solar data |
| `/api/autocomplete` | GET | Bearer | Location suggestions (Nominatim) |
| `/api/cache/clear` | POST | Bearer | Clear cached location (all if no location param) |
| `/api/cache/list` | GET | Bearer | List all cached locations |
| `/api/health` | GET | No | Health check |

### Data Flow
1. User logs in → token stored in localStorage
2. Location search → Nominatim geocoding via `/api/autocomplete`
3. Data request → Worker checks KV cache, or fetches Visual Crossing API
4. Worker calculates solar geometry (monthly optimal tilt, yearly fixed tilt, flat)
5. Frontend renders tables and Chart.js visualizations

### Key Patterns

**Path Aliases (Vite/TypeScript):**
- `@components/*` → `src/components/*`
- `@services/*` → `src/services/*`
- `@stores/*` → `src/stores/*`
- `@types/*` → `src/types/*`
- `@utils/*` → `src/utils/*`

**View Toggle System:**
- All sections (Weather, Solar, Power Gen) support Table/Graph toggle
- Uses `data-section` and `data-view` attributes
- Elements with `.view-content` class are automatically shown/hidden
- Solar section has secondary PSH/Tilt toggle (only visible in graph mode)
- Power Gen section has secondary Daily/Monthly toggle (only visible in graph mode)
- View toggle logic in `viewToggleService.ts`

**Chart.js Integration:**
- Chart.js loaded via CDN (global `Chart` object)
- Vite configured with `external: ['chart.js']` for builds
- `chartUtils.ts` manages theme-aware defaults
- Charts re-render on theme change

**Alpine.js Stores:**
- Modular store architecture with separate concerns
- `auth` store: Authentication state and token management
- `data` store: Location and weather/solar data
- `powerGen` store: Power generation calculator state
- `ui` store: Theme, view toggles, error messages
- Components access via `Alpine.store('auth')`, `Alpine.store('data')`, etc.

**Constants** (no magic numbers):
- Frontend: `AUTOCOMPLETE_DEBOUNCE_MS` (300), `CHART_RESIZE_DEBOUNCE_MS` (100), `POWER_ROUNDING_DECIMALS` (2)
- Backend: `LATITUDE_BANDS`, `TILT_PENALTY_EXPONENT` (1.5), `NOMINATIM_USER_AGENT`, `AUTOCOMPLETE_LIMIT` (8)

**Solar Calculations:**
- Worker caches by normalized location key (lowercase, underscores)
- Latitude-dependent gain factors (defined in `LATITUDE_BANDS`):
  - Equatorial (0-20°): 1.03-1.15x multiplier
  - Mid-latitude (20-45°): 1.05-1.40x multiplier
  - High-latitude (45-60°): 1.15-1.80x multiplier
  - Polar (60°+): 1.20-2.20x multiplier
  - Penalty curve uses cos^1.5 for steeper fixed tilt deviation cost

## Environment Variables (Worker)

| Variable | Type | Description |
|----------|------|-------------|
| `VISUAL_CROSSING_API_KEY` | Secret | Weather API key |
| `SITE_PASSWORD` | Secret | Login password |
| `YEARS_OF_DATA` | Env var | Historical years to fetch (default: 2) |
| `CACHE_TTL` | Env var | Cache duration in seconds (default: 2592000) |

Set secrets via: `wrangler secret put SECRET_NAME`
