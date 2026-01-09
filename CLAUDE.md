# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend
```bash
cd frontend
npm run dev      # Serve on http://localhost:3000
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

**Stack**: Pure HTML/CSS/JS frontend + Cloudflare Worker backend + KV caching

### Frontend (`frontend/`)
ES6 modules with no build step. Key files:
- `js/app.js` - Main orchestrator, event listeners, view toggle setup
- `js/api.js` - Fetch wrapper with auth headers
- `js/auth.js` - Token management (localStorage)
- `js/config.js` - Environment-based API URL detection, shared constants
- `js/dom.js` - Centralized DOM element references
- `js/charts.js` - Chart.js integration (dynamic Y-axis scaling)
- `js/chart-utils.js` - Shared chart utilities (theme defaults, safe destroy)
- `js/autocomplete.js` - Location search with debouncing, section view toggle handlers
- `js/theme.js` - Light/dark theme toggle (persisted to localStorage)
- `js/login.js` - Login form setup and event handling
- `js/results.js` - Results display orchestration, toggle visibility initialization
- `js/tables.js` - Table rendering for weather, solar, and power generation data
- `js/ui.js` - UI state management (loading, error, results display)
- `js/cache.js` - Cache management functionality
- `js/utils.js` - Utility functions (URL params, HTML escaping, color conversion)
- `js/powergen.js` - Power generation calculator with monthly/hourly charts and table integration

### Worker (`worker/src/index.js`)
Single file containing all backend logic (~640 lines):
- Authentication: HMAC-SHA256 tokens with 24-hour expiry
  - `requireAuth()` middleware for consistent auth validation
  - `importHmacKey()` helper for crypto key setup
- Solar calculations: Latitude-dependent tilt angle optimization with solar declination
  - `parseLocationRequest()` - validates and extracts location
  - `buildWeatherApiUrl()` - constructs API URL
  - `enhanceResolvedAddress()` - reverse geocoding with Nominatim
  - `processWeatherData()` - aggregates daily weather to monthly
  - `processSolarData()` - calculates PSH with tilt optimizations
- Caching: Cloudflare KV with 30-day TTL
- CORS: Hardcoded allowed origins list

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
- **Code Organization**:
  - `dom.js` centralizes all `document.querySelector` calls to avoid duplication
  - `chart-utils.js` provides shared Chart.js utilities (`updateChartDefaults`, `safeDestroyChart`)
  - `config.js` auto-detects localhost vs production for API URL and defines shared constants
  - Helper functions in worker break down complex logic into focused, testable units

- **View Toggle System**:
  - All sections (Weather, Solar, Power Gen) support Table/Graph toggle using `data-section` and `data-view` attributes
  - Elements with `.view-content` class are automatically shown/hidden based on active view
  - Solar section has secondary PSH/Tilt toggle (only visible in graph mode)
  - Power Gen section has secondary Daily/Monthly toggle (only visible in graph mode)
  - Toggle handlers in `autocomplete.js` manage chart resizing and sub-toggle visibility
  - Hourly chart has independent visibility (not part of view toggle system)

- **UI Structure Pattern**:
  - Section header (with toggle buttons)
  - Description label (visible in both table and graph views)
  - Table container (`.view-content` with `data-view="table"`)
  - Chart container (`.view-content` with `data-view="graph"`)
  - Labels positioned above content for consistent UX

- **Constants** (no magic numbers):
  - Frontend: `AUTOCOMPLETE_DEBOUNCE_MS` (300), `CHART_RESIZE_DEBOUNCE_MS` (100), `POWER_ROUNDING_DECIMALS` (2)
  - Backend: `LATITUDE_BANDS`, `TILT_PENALTY_EXPONENT` (1.5), `NOMINATIM_USER_AGENT`, `AUTOCOMPLETE_LIMIT` (8)

- **Performance Optimizations**:
  - Array operations use single `reduce()` pass instead of multiple `map()` calls
  - Chart data extracted in one iteration for better performance

- **Table Rendering**:
  - Weather: Monthly temp (high/low/mean) and humidity
  - Solar: Tilt angles and PSH values for monthly optimal, yearly fixed, and flat (0°) configurations
  - Power Gen: Daily and monthly kWh for all tilt methods, with annual totals in footer

- **Caching & Solar Calculations**:
  - Worker caches by normalized location key (lowercase, underscores)
  - Solar tilt calculations use latitude-dependent gain factors (defined in `LATITUDE_BANDS`):
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
