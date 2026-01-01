# Solar Planner

A web app for viewing historical weather data and peak sun hours (PSH) for solar panel planning. Enter any location to see monthly weather averages and compare solar energy potential across different panel tilt configurations.

## Features

- **Password Protection**: Secure access with password authentication (tokens expire after 24 hours)
- **Historical Weather Data**: Monthly averages for high/low/mean temperature, humidity, and sunshine hours
- **Peak Sun Hours (PSH)**: Solar energy potential in kWh/m²/day for three panel configurations:
  - Monthly optimal tilt (adjusted each month for maximum energy)
  - Yearly fixed optimal tilt (set to latitude angle)
  - Flat mount (0° tilt, horizontal)
- **Interactive Charts**: Visualize data with Chart.js graphs
- **Fast & Cached**: Results cached for 30 days to minimize API calls
- **Mobile Friendly**: Responsive design works on all devices

## Tech Stack

- **Frontend**: Pure HTML, CSS, JavaScript with Chart.js
- **Backend**: Cloudflare Worker (serverless)
- **Data Source**: Visual Crossing Weather API
- **Caching**: Cloudflare KV

## Project Structure

```
Solar-Planner/
├── frontend/
│   ├── index.html          # Main page
│   ├── styles.css          # Styling
│   ├── app.js              # Frontend logic
│   └── assets/
│       └── CT_LOGO.webp    # Logo
├── worker/
│   ├── wrangler.toml       # Worker configuration
│   ├── package.json        # Dependencies
│   └── src/
│       └── index.js        # Worker API logic
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

**Cloudflare Pages (Recommended):**

1. Push code to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > **Pages** > **Create a project** > **Connect to Git**
3. Configure:
   - **Framework preset**: None
   - **Build output directory**: `frontend`
4. **Configure Worker Binding** (IMPORTANT):
   - Go to your Pages project settings
   - Navigate to **Functions** > **Workers**
   - Add a worker binding:
     - **Variable name**: `SOLAR_PLANNER_API`
     - **Service**: Select your deployed `solar-planner-api` worker
   - Save the configuration

**Or deploy to any static host** (Netlify, Vercel, etc.) and update `API_URL` in `frontend/app.js` to your worker URL.

## Local Development

### Setup Local Environment Variables

Create a `.dev.vars` file in the `worker/` directory with your credentials:

```bash
cd worker
```

Create `.dev.vars`:
```
SITE_PASSWORD=your-password-here
VISUAL_CROSSING_API_KEY=your-api-key-here
```

**Note:** `.dev.vars` is already in `.gitignore` and won't be committed to git.

### Run Worker

```bash
cd worker
npm run dev
```

Worker runs at `http://localhost:8787`

### Run Frontend

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

**Note on Visual Crossing API Limits:**
- Free tier allows up to **1,000 records per day**
- Each day of historical data counts as 1 record
- Default is 2 years (~730 days) to stay well under the free tier limit
- If you upgrade your Visual Crossing plan, you can increase `YEARS_OF_DATA` (e.g., set to 5 for more historical data)

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

### GET /api/health

Health check endpoint.

**Response:**
```json
{ "status": "ok", "timestamp": "2024-12-31T12:00:00.000Z" }
```

## Troubleshooting

**Location not found**: Check spelling, try adding state/country, or use coordinates.

**CORS errors**: Ensure `API_URL` in `frontend/app.js` matches your worker URL.

**Empty/stale data**: Clear KV cache in Cloudflare Dashboard or verify API key: `wrangler secret list`

**Login issues**: Verify `SITE_PASSWORD` is set correctly. Tokens expire after 24 hours.

**Worker deployment fails**: Check `wrangler.toml` has correct KV namespace IDs and secrets are set.

## License

MIT License

## Credits

- Weather data: [Visual Crossing Weather API](https://www.visualcrossing.com/)
- Charts: [Chart.js](https://www.chartjs.org/)
- Hosting: [Cloudflare](https://www.cloudflare.com/)
