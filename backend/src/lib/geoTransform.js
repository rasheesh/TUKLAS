/**
 * Converts a PostGIS ST_AsGeoJSON() string into { lat, lng }.
 * GeoJSON spec: coordinates are [longitude, latitude].
 *
 * @param {string|null} geoJsonString - output of ST_AsGeoJSON(location_coords)
 * @returns {{ lat: number, lng: number } | null}
 */
export function pointToLatLng(geoJsonString) {
  if (!geoJsonString) return null;
  try {
    const parsed = typeof geoJsonString === 'string'
      ? JSON.parse(geoJsonString)
      : geoJsonString;
    if (parsed?.type !== 'Point' || !Array.isArray(parsed.coordinates)) return null;
    const [lng, lat] = parsed.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}
