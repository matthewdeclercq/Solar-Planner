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
- `js/app.js` - Main orchestrator, event listeners
- `js/api.js` - Fetch wrapper with auth headers
- `js/auth.js` - Token management (localStorage)
- `js/config.js` - Environment-based API URL detection
- `js/dom.js` - Centralized DOM element references
- `js/charts.js` - Chart.js integration (dynamic Y-axis scaling)
- `js/autocomplete.js` - Location search with debouncing
- `js/theme.js` - Light/dark theme toggle (persisted to localStorage)
- `js/login.js` - Login form setup and event handling
- `js/results.js` - Results display orchestration
- `js/tables.js` - Table rendering for weather and solar data
- `js/ui.js` - UI state management (loading, error, results display)
- `js/cache.js` - Cache management functionality
- `js/utils.js` - Utility functions (URL params, HTML escaping, color conversion)
- `js/powergen.js` - Power generation calculator with monthly/hourly charts

### Worker (`worker/src/index.js`)
Single file containing all backend logic (~696 lines):
- Authentication: HMAC-SHA256 tokens with 24-hour expiry
- Solar calculations: Tilt angle optimization based on latitude and solar declination
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
- `dom.js` centralizes all `document.querySelector` calls to avoid duplication
- `config.js` auto-detects localhost vs production for API URL
- Worker caches by normalized location key (lowercase, underscores)
- Solar tilt calculations use trigonometric gain factors (1.05-1.45x multiplier)

## Environment Variables (Worker)

| Variable | Type | Description |
|----------|------|-------------|
| `VISUAL_CROSSING_API_KEY` | Secret | Weather API key |
| `SITE_PASSWORD` | Secret | Login password |
| `YEARS_OF_DATA` | Env var | Historical years to fetch (default: 2) |
| `CACHE_TTL` | Env var | Cache duration in seconds (default: 2592000) |

Set secrets via: `wrangler secret put SECRET_NAME`
