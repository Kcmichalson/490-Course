// Climate summary of one tile (Artifact 3): the small JSON that
// tools/companion.py sends to Claude Code. Pure, no DOM: main.js gathers
// what the sim has already computed at the clicked pixel and this shapes it.
// Only this tile's numbers go in, never the map.

export const SUMMARY_FORMAT = 'fcm-tile-summary';
export const SUMMARY_VERSION = 1;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const round = (v, places) => {
  const f = 10 ** places;
  return Math.round(v * f) / f || 0; // || 0: no −0 in the JSON
};

// f: { lat, lon, elevationM, category, koppenCode, koppenName,
//   temps (12 monthly means, °C), rain (12 monthly totals, mm),
//   wind ({ fromDeg, compass, speed, season } | { variable, meanSpeed,
//   season } | null), coastKm (km inland) }
export function tileSummary(f) {
  const temps = Array.from(f.temps, (t) => round(t, 1));
  const rain = Array.from(f.rain, (p) => round(p, 1));
  let wind = null;
  if (f.wind?.variable) wind = { variable: true, mean_speed: round(f.wind.meanSpeed, 2), season: f.wind.season };
  else if (f.wind) wind = { from_deg: f.wind.fromDeg, from_compass: f.wind.compass, speed: round(f.wind.speed, 2), season: f.wind.season };
  return {
    format: SUMMARY_FORMAT,
    version: SUMMARY_VERSION,
    units: {
      temperature: '°C (monthly means)',
      precipitation: 'mm per month',
      elevation: 'm above sea level',
      distance: 'km',
      wind_speed: 'relative, unitless (0–1 scale of the model)',
    },
    lat: round(f.lat, 2),
    lon: round(f.lon, 2),
    elevation_m: Math.round(f.elevationM),
    category: f.category,
    koppen: { code: f.koppenCode, name: f.koppenName },
    months: MONTHS,
    temperature_c: {
      monthly: temps,
      warmest: Math.max(...temps),
      coldest: Math.min(...temps),
      annual_mean: round(f.temps.reduce((a, b) => a + b, 0) / 12, 1),
    },
    precipitation_mm: {
      monthly: rain,
      annual: Math.round(f.rain.reduce((a, b) => a + b, 0)),
    },
    wind,
    distance_to_coast_km: Math.round(f.coastKm),
  };
}

// "fcm-tile-48.86N_2.35E.json"
export function summaryFileName(lat, lon) {
  const la = round(lat, 2);
  const lo = round(lon, 2);
  const ns = `${Math.abs(la).toFixed(2)}${la < 0 ? 'S' : 'N'}`;
  const ew = `${Math.abs(lo).toFixed(2)}${lo < 0 ? 'W' : 'E'}`;
  return `fcm-tile-${ns}_${ew}.json`;
}
