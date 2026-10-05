const config = require('../config/config');

const UPSTREAM_TIMEOUT_MS = 8000;

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': config.geo.userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`Upstream responded with ${response.status}`);
    error.upstream = true;
    throw error;
  }
  return response.json();
};

/**
 * Place search for the address picker (Nominatim). Optional lat/lng biases the
 * results towards the user, so "near me" style searches rank local hits first.
 */
exports.searchPlaces = async (req, res) => {
  try {
    const { q, lat, lng } = req.query;
    const params = new URLSearchParams({
      format: 'jsonv2',
      q,
      limit: '8',
      addressdetails: '1',
    });

    if (lat && lng) {
      // Zoom 12 keeps the bias local without hiding city-level matches.
      params.set('viewbox', `${lng},${lat},${lng},${lat}`);
      params.set('bounded', '0');
    }

    const data = await fetchJson(`${config.geo.nominatimUrl}/search?${params.toString()}`);

    const results = (Array.isArray(data) ? data : []).map((item) => ({
      label: item.display_name,
      name: item.name,
      category: item.type,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }));

    return res.json({ results });
  } catch (error) {
    if (error.upstream) {
      return res.status(502).json({ message: 'Place search is unavailable right now.', error: error.message });
    }
    return res.status(500).json({ message: 'Failed to search places.', error: error.message });
  }
};

/** Turn coordinates into a human-readable address (used when the map is dropped). */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const data = await fetchJson(
      `${config.geo.nominatimUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
    );

    return res.json({
      label: data.display_name || null,
      name: data.name || null,
      address: data.address || null,
    });
  } catch (error) {
    if (error.upstream) {
      return res.status(502).json({ message: 'Address lookup is unavailable right now.', error: error.message });
    }
    return res.status(500).json({ message: 'Failed to look up address.', error: error.message });
  }
};

/**
 * Driving route between two points (OSRM). Returns distance, ETA and a polyline
 * as [lat, lng] pairs so the map can draw it without another conversion step.
 */
exports.getRoute = async (req, res) => {
  try {
    const { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng } = req.query;

    const coordinates = `${fromLng},${fromLat};${toLng},${toLat}`;
    const data = await fetchJson(
      `${config.geo.osrmUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    );

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ message: 'No route found between those points.' });
    }

    const route = data.routes[0];

    return res.json({
      distance_m: route.distance,
      duration_s: route.duration,
      // GeoJSON is [lng, lat]; flip to [lat, lng] which is what the map expects.
      geometry: (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
    });
  } catch (error) {
    if (error.upstream) {
      return res.status(502).json({ message: 'Routing is unavailable right now.', error: error.message });
    }
    return res.status(500).json({ message: 'Failed to calculate route.', error: error.message });
  }
};