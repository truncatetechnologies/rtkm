// Server-side geocoding. Uses Google Geocoding if GOOGLE_GEOCODING_KEY is set,
// otherwise falls back to free OpenStreetMap Nominatim.

export async function geocode(address) {
  const query = (address || "").trim();
  if (!query) return null;

  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (key) {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(query) + "&key=" + key;
    const res = await fetch(url);
    const data = await res.json();
    const r = data?.results?.[0]?.geometry?.location;
    if (r) return { lat: r.lat, lng: r.lng, provider: "google" };
    return null;
  }

  // Nominatim (please respect its usage policy; identify with a UA).
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { "User-Agent": "RTKM-App/1.0 (admin geocoding)" },
  });
  const data = await res.json();
  const r = data?.[0];
  if (r) return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), provider: "nominatim" };
  return null;
}
