// Weather check for scheduled outdoor jobs — free, no key, no account.
// Geocodes the job address with OpenStreetMap Nominatim, then fetches the
// Open-Meteo forecast for the scheduled date. Matches the app's no-key
// rule: nothing here needs an API key. Every failure is soft — the caller
// shows a plain note instead of an error.
export async function checkJobWeather(job) {
  const address = (job.address || '').trim()
  const date = job.scheduledDate
  if (!address) return { ok: false, reason: 'no-address' }
  if (!date) return { ok: false, reason: 'no-date' }
  let geo = null
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('geocode ' + r.status)
    const arr = await r.json()
    if (!arr || !arr.length) return { ok: false, reason: 'not-found' }
    geo = arr[0]
  } catch (e) {
    return { ok: false, reason: 'network' }
  }
  const lat = Number(geo.lat)
  const lng = Number(geo.lon)
  let fc = null
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${date}&end_date=${date}`)
    if (!r.ok) throw new Error('forecast ' + r.status)
    fc = await r.json()
  } catch (e) {
    return { ok: false, reason: 'network' }
  }
  const prob = fc?.daily?.precipitation_probability_max?.[0]
  const sum = fc?.daily?.precipitation_sum?.[0]
  const rain = (prob != null && prob >= 50) || (sum != null && sum >= 2)
  const probText = prob != null ? `${prob}%` : '?'
  const sumText = sum != null ? `${sum}mm` : '?'
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    date,
    address,
    place: geo.display_name || '',
    lat,
    lng,
    precipProb: prob ?? null,
    precipSum: sum ?? null,
    rain,
    summary: rain
      ? `Rain likely on ${date} — ${probText} chance, ${sumText} expected. Plan cover or move the outdoor work.`
      : `Looks dry on ${date} — ${probText} chance of rain, ${sumText} expected.`,
  }
}
