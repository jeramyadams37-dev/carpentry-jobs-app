// Gemini AI help — direct from the phone to Google's Gemini API.
// Bring your own key: the key lives in Settings (on-device only) and is
// NEVER bundled in the app, the repo, or any fallback. No backend.
import { bidMaterialsTotal, bidTotal, effectiveLabor } from './store.js'
export async function askGemini(apiKey, model, messages) {
  const m = (model || 'gemini-2.0-flash').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const contents = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }))
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    })
  } catch (e) {
    throw new Error('Could not reach Google. Check the connection and try again.')
  }
  let data = null
  try { data = await res.json() } catch (e) { /* ignore */ }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Google returned ${res.status}`
    if (res.status === 400) throw new Error('Google rejected the request: ' + msg + ' — check the model name in Settings.')
    if (res.status === 401 || res.status === 403) throw new Error('Google rejected the API key: ' + msg + ' — check the key in Settings.')
    if (res.status === 429) throw new Error('Free-tier limit hit for now. Wait a bit and try again.')
    throw new Error(msg)
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text) throw new Error('Google returned an empty answer. Try rephrasing the question.')
  return text
}

export function jobContextBlock(job) {
  if (!job) return ''
  const lines = []
  lines.push(`Job: ${job.title || 'Untitled job'} (${job.jobType || 'general carpentry'})`)
  lines.push(`Customer: ${job.customerName || '—'}`)
  lines.push(`Status: ${job.status || '—'}`)
  if (job.description) lines.push(`Description: ${job.description}`)
  if (job.bids && job.bids.length) {
    for (const b of job.bids) {
      lines.push(`Bid "${b.label}": $${bidTotal(b).toFixed(2)} (materials $${bidMaterialsTotal(b).toFixed(2)}, labor $${effectiveLabor(b).toFixed(2)}, other $${(Number(b.other) || 0).toFixed(2)}, markup ${Number(b.markupPct) || 0}%) — scope: ${b.scope || '—'}`)
    }
  }
  if (job.tools && job.tools.length) {
    lines.push('Tools: ' + job.tools.map((t) => `${t.name} (${t.owned ? 'owned' : 'rented $' + (Number(t.rentalCost) || 0)})`).join(', '))
  }
  if (job.notes && job.notes.length) {
    lines.push('Notes: ' + job.notes.slice(-5).map((n) => n.text).join(' | '))
  }
  return lines.join('\n')
}

export const PROMPT_CHIPS = [
  'Check my estimate — is this price fair?',
  'Check my material list — anything missing?',
  'What does the building code say about this?',
  'How do I fix this problem?',
  'What should I charge for this kind of job?',
  'Write ad copy for this job.',
]

// ---- Gemini vision ----
// Photos sent here go to Google's Gemini API — the in-app copy says so
// plainly. Uses the same bring-your-own key as text chat. No key, no call.
export async function askGeminiVision(apiKey, model, prompt, images) {
  const m = (model || 'gemini-2.0-flash').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const parts = [{ text: prompt }]
  for (const img of images || []) {
    const dataUrl = img.dataUrl || img
    const comma = String(dataUrl).indexOf(',')
    const b64 = comma >= 0 ? String(dataUrl).slice(comma + 1) : String(dataUrl)
    const mime = String(dataUrl).includes('image/png') ? 'image/png' : 'image/jpeg'
    parts.push({ inline_data: { mime_type: mime, data: b64 } })
  }
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
    })
  } catch (e) {
    throw new Error('Could not reach Google. Check the connection and try again.')
  }
  let data = null
  try { data = await res.json() } catch (e) { /* ignore */ }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Google returned ${res.status}`
    if (res.status === 400) throw new Error('Google rejected the request: ' + msg + ' — check the model name in Settings.')
    if (res.status === 401 || res.status === 403) throw new Error('Google rejected the API key: ' + msg + ' — check the key in Settings.')
    if (res.status === 429) throw new Error('Free-tier limit hit for now. Wait a bit and try again.')
    throw new Error(msg)
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text) throw new Error('Google returned an empty answer. Try again with clearer photos.')
  return text
}

// Pull a JSON object out of a model reply (it often wraps it in fences).
export function extractJson(text) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(body.slice(start, end + 1)) } catch (e) { return null }
}

export function bidPhotoPrompt(job) {
  return [
    'You are helping a carpenter price a job from before photos.',
    'Look at the attached before photos and draft an estimate. Be practical and plain.',
    'Return ONLY a JSON object (no other text) with this shape:',
    '{ "scope": "short scope of work",',
    '  "materials": [ { "name": "item", "qty": 1, "unitCost": 0 } ],',
    '  "laborHours": 0,',
    '  "notes": "things to check on site before finalizing",',
    '  "codeIssues": "any possible building-code issues you can see, with the section if you know it" }',
    'Materials: list what you can see is needed, with realistic quantities and typical US retail unit prices.',
    'Labor hours: your best estimate for one experienced carpenter.',
    'If a photo is unclear, say so in notes instead of guessing.',
    job && job.description ? `Job description from the carpenter: ${job.description}` : '',
    job && job.jobType ? `Job type: ${job.jobType}` : '',
  ].filter(Boolean).join('\n')
}

export function receiptPrompt() {
  return [
    'Read this receipt photo and return ONLY a JSON object (no other text):',
    '{ "vendor": "store name", "amount": 0, "date": "YYYY-MM-DD", "category": "materials" | "labor" | "other", "label": "short description" }',
    'If you cannot read a field, use your best guess for category and leave the rest blank ("").',
  ].join('\n')
}
