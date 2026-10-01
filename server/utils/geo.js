const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Bounding box used to prefilter in MongoDB before exact haversine filtering
export function boundingBox(lat, lng, km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.01, Math.cos(rad(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
// Rounds coordinates to ~1km so an approximate user location is never precise
export const approx = (n) => Math.round(n * 100) / 100;
