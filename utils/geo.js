/**
 * FoodFlow Geolocation and Pakistan Address Utility
 * Accurate distance calculations, ETA estimation, and Pakistani city/landmark registry.
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate Haversine distance between two latitude/longitude points in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers (rounded to 2 decimal places)
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return null;
  }

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = EARTH_RADIUS_KM * c;
  return Math.round(d * 100) / 100;
};

const toRad = (value) => (value * Math.PI) / 180;

/**
 * Calculate realistic delivery ETA in minutes.
 * Average delivery rider speed in Pakistani urban traffic is 22-28 km/h,
 * plus 5-8 minutes buffer for parking, stairs/elevators, and handover.
 * @param {number} distanceKm
 * @param {number} speedKmh
 * @returns {number} Estimated minutes
 */
export const calculateEtaMinutes = (distanceKm, speedKmh = 25) => {
  if (!distanceKm || distanceKm <= 0) return 10;
  const transitMinutes = (distanceKm / speedKmh) * 60;
  const bufferMinutes = 5; // dispatch / doorstep handover
  return Math.max(8, Math.round(transitMinutes + bufferMinutes));
};

/**
 * Predefined centroid coordinates for major Pakistani urban centers.
 */
export const PAKISTAN_CITIES = {
  Karachi: { lat: 24.8607, lng: 67.0011, province: 'Sindh' },
  Lahore: { lat: 31.5204, lng: 74.3587, province: 'Punjab' },
  Islamabad: { lat: 33.6844, lng: 73.0479, province: 'Federal Capital' },
  Rawalpindi: { lat: 33.5651, lng: 73.0169, province: 'Punjab' },
  Faisalabad: { lat: 31.4504, lng: 73.1350, province: 'Punjab' },
  Multan: { lat: 30.1575, lng: 71.5249, province: 'Punjab' },
  Peshawar: { lat: 34.0151, lng: 71.5249, province: 'Khyber Pakhtunkhwa' },
  Quetta: { lat: 30.1798, lng: 66.9750, province: 'Balochistan' },
  Sialkot: { lat: 32.4945, lng: 74.5229, province: 'Punjab' },
  Gujranwala: { lat: 32.1877, lng: 74.1945, province: 'Punjab' },
  Hyderabad: { lat: 25.3960, lng: 68.3578, province: 'Sindh' },
};

/**
 * Curated offline Pakistani landmarks and neighborhoods
 * Enables high-precision address selection and zone testing even when Google Places API is unavailable.
 */
export const PAKISTAN_LANDMARKS = [
  // Karachi
  { name: 'Clifton Block 2 (Boat Basin)', city: 'Karachi', area: 'Clifton', lat: 24.8256, lng: 67.0278 },
  { name: 'Clifton Block 4 (Sea View)', city: 'Karachi', area: 'Clifton', lat: 24.8085, lng: 67.0322 },
  { name: 'DHA Phase 5 (Khayaban-e-Shahbaz)', city: 'Karachi', area: 'DHA', lat: 24.8012, lng: 67.0543 },
  { name: 'DHA Phase 6 (Khayaban-e-Bukhari)', city: 'Karachi', area: 'DHA', lat: 24.7891, lng: 67.0678 },
  { name: 'Gulshan-e-Iqbal Block 13-D', city: 'Karachi', area: 'Gulshan-e-Iqbal', lat: 24.9180, lng: 67.0862 },
  { name: 'Gulshan-e-Iqbal Block 6', city: 'Karachi', area: 'Gulshan-e-Iqbal', lat: 24.9312, lng: 67.0984 },
  { name: 'North Nazimabad Block H', city: 'Karachi', area: 'North Nazimabad', lat: 24.9432, lng: 67.0421 },
  { name: 'PECHS Block 2 (Tariq Road)', city: 'Karachi', area: 'PECHS', lat: 24.8715, lng: 67.0612 },
  { name: 'Saddar (Empress Market)', city: 'Karachi', area: 'Saddar', lat: 24.8569, lng: 67.0298 },
  { name: 'Bahria Town Karachi (Precicnt 1)', city: 'Karachi', area: 'Bahria Town', lat: 25.0112, lng: 67.3321 },
  { name: 'Korangi Industrial Area Sector 23', city: 'Karachi', area: 'Korangi', lat: 24.8351, lng: 67.1321 },
  { name: 'Gulistan-e-Johar Block 15', city: 'Karachi', area: 'Gulistan-e-Johar', lat: 24.9214, lng: 67.1389 },

  // Lahore
  { name: 'Gulberg III (MM Alam Road)', city: 'Lahore', area: 'Gulberg', lat: 31.5115, lng: 74.3542 },
  { name: 'Gulberg II (Main Market)', city: 'Lahore', area: 'Gulberg', lat: 31.5289, lng: 74.3498 },
  { name: 'DHA Phase 3 (Y Block Market)', city: 'Lahore', area: 'DHA', lat: 31.4721, lng: 74.3812 },
  { name: 'DHA Phase 5 (Civic Commercial Area)', city: 'Lahore', area: 'DHA', lat: 31.4552, lng: 74.4021 },
  { name: 'Model Town Block C', city: 'Lahore', area: 'Model Town', lat: 31.4882, lng: 74.3215 },
  { name: 'Johar Town Phase 2 (G1 Market)', city: 'Lahore', area: 'Johar Town', lat: 31.4651, lng: 74.2789 },
  { name: 'Mall Road (Anarkali Bazaar)', city: 'Lahore', area: 'Mall Road', lat: 31.5658, lng: 74.3142 },
  { name: 'Faisal Town Block B', city: 'Lahore', area: 'Faisal Town', lat: 31.4791, lng: 74.3051 },
  { name: 'Bahria Town Lahore (Sector C Commercial)', city: 'Lahore', area: 'Bahria Town', lat: 31.3654, lng: 74.1812 },

  // Islamabad
  { name: 'Sector F-6/2 (Super Market)', city: 'Islamabad', area: 'Sector F-6', lat: 33.7312, lng: 73.0762 },
  { name: 'Sector F-7/2 (Jinnah Super Market)', city: 'Islamabad', area: 'Sector F-7', lat: 33.7215, lng: 73.0556 },
  { name: 'Sector F-8/3 (Centaurus Mall Vicinity)', city: 'Islamabad', area: 'Sector F-8', lat: 33.7102, lng: 73.0412 },
  { name: 'Sector F-10/3 (F-10 Markaz)', city: 'Islamabad', area: 'Sector F-10', lat: 33.6985, lng: 73.0125 },
  { name: 'Sector F-11/1 (F-11 Markaz)', city: 'Islamabad', area: 'Sector F-11', lat: 33.6854, lng: 72.9892 },
  { name: 'Sector G-9/4 (Karachi Company Markaz)', city: 'Islamabad', area: 'Sector G-9', lat: 33.6912, lng: 73.0315 },
  { name: 'Blue Area (Jinnah Avenue)', city: 'Islamabad', area: 'Blue Area', lat: 33.7145, lng: 73.0612 },
  { name: 'Sector I-8/4 (I-8 Markaz)', city: 'Islamabad', area: 'Sector I-8', lat: 33.6678, lng: 73.0745 },
  { name: 'Bahria Town Islamabad (Phase 4 Civic)', city: 'Islamabad', area: 'Bahria Town', lat: 33.5321, lng: 73.1125 },

  // Rawalpindi
  { name: 'Saddar (Bank Road Commercial)', city: 'Rawalpindi', area: 'Saddar', lat: 33.5952, lng: 73.0543 },
  { name: 'Satellite Town Commercial Market', city: 'Rawalpindi', area: 'Satellite Town', lat: 33.6354, lng: 73.0698 },
  { name: 'Westridge 1 (Peshawar Road)', city: 'Rawalpindi', area: 'Westridge', lat: 33.6021, lng: 73.0189 },
  { name: 'Bahria Town Rawalpindi Phase 7', city: 'Rawalpindi', area: 'Bahria Town', lat: 33.5189, lng: 73.1045 },

  // Faisalabad
  { name: 'D Ground Commercial Area', city: 'Faisalabad', area: 'Peoples Colony', lat: 31.4089, lng: 73.0987 },
  { name: 'Kohinoor City (Jaranwala Road)', city: 'Faisalabad', area: 'Kohinoor', lat: 31.4192, lng: 73.1154 },
  { name: 'Madina Town Main Boulevard', city: 'Faisalabad', area: 'Madina Town', lat: 31.4356, lng: 73.1298 },

  // Multan
  { name: 'Gulgasht Colony Gol Bagh', city: 'Multan', area: 'Gulgasht', lat: 30.2289, lng: 71.4872 },
  { name: 'Multan Cantt (Mall Road)', city: 'Multan', area: 'Cantt', lat: 30.1895, lng: 71.4589 },
  { name: 'Bosan Road Commercial Hub', city: 'Multan', area: 'Bosan Road', lat: 30.2451, lng: 71.5012 },

  // Peshawar
  { name: 'University Town (Jamrud Road)', city: 'Peshawar', area: 'University Town', lat: 33.9985, lng: 71.4921 },
  { name: 'Hayatabad Phase 5 (Civic Centre)', city: 'Peshawar', area: 'Hayatabad', lat: 33.9745, lng: 71.4421 },
  { name: 'Saddar Cantt (Saddar Road)', city: 'Peshawar', area: 'Cantt', lat: 34.0089, lng: 71.5512 },
];

/**
 * Filter landmarks matching search query and optional city.
 */
export const searchPakistanPlaces = (query = '', city = '') => {
  const cleanQ = (query || '').toLowerCase().trim();
  const cleanCity = (city || '').toLowerCase().trim();

  return PAKISTAN_LANDMARKS.filter((item) => {
    const matchesCity = !cleanCity || item.city.toLowerCase() === cleanCity;
    if (!cleanQ) return matchesCity;
    const matchesQuery =
      item.name.toLowerCase().includes(cleanQ) ||
      item.area.toLowerCase().includes(cleanQ) ||
      item.city.toLowerCase().includes(cleanQ);
    return matchesCity && matchesQuery;
  }).slice(0, 15);
};

/**
 * Get fallback city coordinates.
 */
export const getCityCoordinates = (cityName = 'Karachi') => {
  const clean = cityName.trim();
  for (const [key, coords] of Object.entries(PAKISTAN_CITIES)) {
    if (key.toLowerCase() === clean.toLowerCase()) {
      return { lat: coords.lat, lng: coords.lng };
    }
  }
  return { lat: 24.8607, lng: 67.0011 }; // Karachi default
};
