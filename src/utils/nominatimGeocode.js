const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'SchoolManagementSuite/1.0 (transport pickup points)'

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en',
  // Browsers may ignore User-Agent, but some environments honour it for Nominatim policy.
  'User-Agent': USER_AGENT,
}

async function parseNominatimResponse(res) {
  const text = await res.text().catch(() => '')
  const trimmed = String(text).trim()
  if (!trimmed) return { data: null, textError: null }
  try {
    return { data: JSON.parse(trimmed), textError: null }
  } catch {
    return { data: null, textError: trimmed }
  }
}

function nominatimFailureMessage(res, textError) {
  if (res.status === 403 || res.status === 429) {
    return 'Map search is temporarily blocked (too many requests). Wait a minute, then click the map to set the pin instead.'
  }
  if (textError && /^Error\s+\d+/i.test(textError)) {
    return 'Map search is unavailable right now. Click the map to set the pin instead.'
  }
  return 'Location not found on map. Try a different name or click the map.'
}

export function buildPickupGeocodeQuery({ name, location, city, state }) {
  return [name, location, city, state].map((s) => String(s ?? '').trim()).filter(Boolean).join(', ')
}

export async function geocodeAddress(query) {
  const q = String(query ?? '').trim()
  if (!q) return { ok: false, error: 'Enter a location to search.' }

  try {
    const params = new URLSearchParams({ format: 'json', limit: '1', q })
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: NOMINATIM_HEADERS,
    })
    const { data, textError } = await parseNominatimResponse(res)
    if (!res.ok || !Array.isArray(data) || !data.length) {
      return { ok: false, error: nominatimFailureMessage(res, textError) }
    }
    const hit = data[0]
    const lat = Number(hit.lat)
    const lng = Number(hit.lon ?? hit.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: 'Invalid coordinates from search.' }
    }
    return {
      ok: true,
      lat,
      lng,
      displayName: String(hit.display_name ?? '').trim() || q,
    }
  } catch {
    return { ok: false, error: 'Could not reach map search. Check your connection.' }
  }
}



export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Invalid coordinates.' }
  }
  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: String(lat),
      lon: String(lng),
    })
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: NOMINATIM_HEADERS,
    })
    const { data, textError } = await parseNominatimResponse(res)
    if (!res.ok || !data || typeof data !== 'object') {
      return {
        ok: false,
        error: textError && /^Error\s+\d+/i.test(textError)
          ? 'Map search is unavailable right now.'
          : 'Could not resolve address for this point.',
      }
    }
    const name = String(data.display_name ?? '').trim()
    return { ok: true, displayName: name }
  } catch {
    return { ok: false, error: 'Could not reach map search.' }
  }
}
