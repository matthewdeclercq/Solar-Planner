# Solar Planner

A web app for viewing historical weather data and peak sun hours for solar panel planning. Enter any location to see monthly weather averages and compare solar energy potential across different panel tilt configurations.

## Features

- **Password Protection**: Password authentication with tokens that expire after 24 hours
- **Historical Weather Data**: Monthly averages for high/low/mean temperature and humidity
- **Peak Sun Hours (PSH)**: Solar energy potential in kWh/m²/day for three panel configurations:
  - Monthly optimal tilt (adjusted each month for maximum energy)
  - Yearly fixed optimal tilt (set to latitude angle)
  - Flat mount (0° tilt, horizontal)
- **Interactive Charts**: Visualize data with graphs and tables
- **Location Search**: Autocomplete with search history from cached locations
- **Theme Toggle**: Switch between light and dark mode
- **Caching**: Results cached for 30 days to minimize API calls
- **Mobile Friendly**: Responsive design works on all devices

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript with Chart.js
- **Backend**: Cloudflare Worker
- **Data Source**: Visual Crossing Weather API
- **Caching**: Cloudflare KV

## Project Structure

```
Solar-Planner/
├── frontend/
│   ├── index.html          # Main page
│   ├── styles.css          # Styling
│   ├── js/
│   │   ├── app.js          # Main application logic
│   │   ├── api.js          # API communication
│   │   ├── auth.js         # Authentication
│   │   ├── autocomplete.js # Location search
│   │   ├── cache.js        # Cache management
│   │   ├── charts.js       # Chart rendering
│   │   ├── config.js       # Configuration
│   │   ├── dom.js          # DOM references
│   │   ├── login.js        # Login handling
│   │   ├── results.js      # Results display
│   │   ├── tables.js       # Table rendering
│   │   ├── theme.js        # Theme toggle
│   │   ├── ui.js           # UI utilities
│   │   └── utils.js        # Utilities
│   └── assets/
│       └── CT_LOGO.webp    # Logo
├── worker/
│   ├── wrangler.toml       # Worker configuration
│   ├── package.json        # Dependencies
│   └── src/
│       └── index.js        # API logic
└── README.md
```

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Visual Crossing API Key**: Get a free key at [visualcrossing.com](https://www.visualcrossing.com/weather-api)
3. **Wrangler CLI**: Install with `npm install -g wrangler`

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
wrangler kv namespace create SOLAR_CACHE
wrangler kv namespace create SOLAR_CACHE --preview
```

Update `wrangler.toml` with the returned namespace IDs.

### 4. Add Secrets

```bash
wrangler secret put VISUAL_CROSSING_API_KEY
wrangler secret put SITE_PASSWORD
```

### 5. Deploy Worker

```bash
wrangler deploy
```

Note your worker URL (e.g., `https://solar-planner-api.matthew-declercq.workers.dev/`).

### 6. Deploy Frontend

**Cloudflare Pages:**

1. Push code to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > **Pages** > **Create a project** > **Connect to Git**
3. Set **Framework preset** to None and **Build output directory** to `frontend`
4. Configure worker binding in project settings: **Functions** > **Workers** > Add binding with variable name `SOLAR_PLANNER_API` pointing to your worker

**Or deploy to any static host** (Netlify, Vercel, etc.) and update `API_URL` in `frontend/js/config.js` to your worker URL.

## Local Development

Create a `.dev.vars` file in the `worker/` directory:

```
SITE_PASSWORD=your-password-here
VISUAL_CROSSING_API_KEY=your-api-key-here
```

Run the worker:

```bash
cd worker
npm run dev
```

Worker runs at `http://localhost:8787`

Run the frontend:

```bash
cd frontend
npm run dev
```

Frontend runs at `http://localhost:3000` and automatically connects to the worker on port 8787.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VISUAL_CROSSING_API_KEY` | API key from Visual Crossing (set as secret) | Yes |
| `SITE_PASSWORD` | Password required to access the site (set as secret) | Yes |
| `YEARS_OF_DATA` | Years of historical data to fetch (default: 2) | No |
| `CACHE_TTL` | Cache duration in seconds (default: 2592000 = 30 days) | No |

**Visual Crossing API Limits:**
- Free tier allows up to 1,000 records per day
- Each day of historical data counts as 1 record
- Default is 2 years (~730 days) to stay under the free tier limit
- Increase `YEARS_OF_DATA` if you upgrade your Visual Crossing plan

## API Endpoints

### POST /api/login

Login with password to get authentication token.

**Request:**
```json
{ "password": "your-password" }
```

**Response:**
```json
{
  "token": "...",
  "expiresAt": 1234567890,
  "expiresIn": 86400
}
```

### POST /api/data

Fetch weather and solar data for a location. Requires `Authorization: Bearer <token>` header.

**Request:**
```json
{ "location": "Austin, TX" }
```

**Response:**
```json
{
  "location": "Austin, TX, United States",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "weather": [...],
  "solar": [...],
  "cached": false
}
```

### GET /api/autocomplete

Get location suggestions for autocomplete. Requires `Authorization: Bearer <token>` header.

**Request:**
```
GET /api/autocomplete?q=Austin
```

**Response:**
```json
{
  "suggestions": [
    {
      "display": "Austin, TX, United States",
      "value": "Austin, TX, United States",
      "apiLocation": "30.2672,-97.7431",
      "lat": 30.2672,
      "lon": -97.7431
    }
  ]
}
```

### GET /api/cache/list

List all cached locations. Requires `Authorization: Bearer <token>` header.

**Response:**
```json
{
  "locations": [
    {
      "key": "location:austin_tx",
      "location": "Austin, TX, United States",
      "originalSearch": "Austin, TX",
      "latitude": 30.2672,
      "longitude": -97.7431,
      "cachedAt": 1234567890
    }
  ]
}
```

### POST /api/cache/clear

Clear cache for a location or all locations. Requires `Authorization: Bearer <token>` header.

**Request:**
```json
{ "location": "Austin, TX" }
```

Or clear all:
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared for location: Austin, TX",
  "deletedCount": 1
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{ "status": "ok", "timestamp": "2024-12-31T12:00:00.000Z" }
```

## Troubleshooting

**Location not found**: Check spelling, try adding state/country, or use coordinates.

**CORS errors**: Ensure `API_URL` in `frontend/js/config.js` matches your worker URL.

**Empty or stale data**: Clear cache using the clear cache button in the app, or verify API key with `wrangler secret list`.

**Login issues**: Verify `SITE_PASSWORD` is set correctly. Tokens expire after 24 hours.

**Worker deployment fails**: Check `wrangler.toml` has correct KV namespace IDs and secrets are set.

## License

MIT License

## Credits

- Weather data: [Visual Crossing Weather API](https://www.visualcrossing.com/)
- Charts: [Chart.js](https://www.chartjs.org/)
- Hosting: [Cloudflare](https://www.cloudflare.com/)
