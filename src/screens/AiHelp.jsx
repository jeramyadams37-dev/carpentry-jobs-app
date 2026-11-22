import React, { useState } from 'react'
import { askGemini, jobContextBlock, extractJson, bidExtractPrompt, PROMPT_CHIPS } from '../lib/gemini.js'
import { nowISO, uid } from '../lib/store.js'

export default function AiHelp({ store, job, onUpdateStore, goSettings, goJob }) {
  const settings = store.settings || {}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [applying, setApplying] = useState('')

  const history = job ? (job.aiHistory || []) : (store.aiGeneral || [])

  function saveHistory(next) {
    if (job) {
      onUpdateStore((s) => {
        const j = s.jobs.find((x) => x.id === job.id)
        if (j) j.aiHistory = next
      })
    } else {
      onUpdateStore((s) => { s.aiGeneral = next })
    }
  }

  async function send(text) {
    const q = (text || input).trim()
    if (!q) return
    if (!settings.geminiApiKey) {
      setError('No Gemini key yet. Add your free key in Settings first — the AI screen explains how to get one.')
      return
    }
    setError('')
    setInput('')
    const context = job ? jobContextBlock(job) : ''
    const full = context
      ? `You are helping a carpenter. Answer plainly and practically, with numbers where they matter. If a building-code question comes up, cite the section and remind him the local inspector has the final say.\n\nJOB CONTEXT:\n${context}\n\nQUESTION:\n${q}`
      : `You are helping a carpenter. Answer plainly and practically, with numbers where they matter. If a building-code question comes up, cite the section and remind him the local inspector has the final say.\n\nQUESTION:\n${q}`
    const userMsg = { id: uid(), role: 'user', text: q, createdAt: nowISO() }
    const withUser = [...history, userMsg]
    saveHistory(withUser)
    setBusy(true)
    try {
      const answer = await askGemini(settings.geminiApiKey, settings.geminiModel, [
        ...withUser.slice(-10).map((m) => ({ role: m.role, text: m.role === 'user' && m.id === userMsg.id ? full : m.text })),
      ])
      saveHistory([...withUser, { id: uid(), role: 'model', text: answer, createdAt: nowISO() }])
    } catch (e) {
      setError(e.message || 'Gemini call failed.')
    } finally {
      setBusy(false)
    }
  }

  function clearHistory() {
    saveHistory([])
  }

  // Turn a Gemini chat answer into a bid draft on this job. Gemini extracts
  // the numbers as strict JSON; the draft lands on a new bid for review in
  // the Bids tab — nothing is accepted or final until the carpenter says so.
  // The FULL conversation up to and including that answer goes along, not
  // just the one answer — earlier turns hold the corrections and details
  // (year built, occupancy, phases, prices already agreed) the answer
  // assumes. Only shown when the chat is job-aware.
  async function applyAnswer(msg) {
    if (!job) return
    if (!settings.geminiApiKey) {
      setError('No Gemini key yet. Add your free key in Settings first — applying an answer uses your own key.')
      return
    }
    setError('')
    setNotice('')
    setApplying(msg.id)
    try {
      const idx = history.findIndex((m) => m.id === msg.id)
      const upto = idx >= 0 ? history.slice(0, idx + 1) : history
      const text = await askGemini(settings.geminiApiKey, settings.geminiModel, [{ role: 'user', text: bidExtractPrompt(msg.text, job, upto) }])
      const parsed = extractJson(text)
      if (!parsed || parsed.noBid || (!parsed.scope && !(Array.isArray(parsed.materials) && parsed.materials.length))) {
        setError('Gemini could not pull usable numbers from that answer — the text is still in the chat above to copy from.')
        return
      }
      const newId = uid()
      const validityDays = Number(settings.quoteValidityDays ?? 30) || 0
      const validUntil = validityDays > 0 ? new Date(Date.now() + validityDays * 86400000).toISOString().slice(0, 10) : ''
      onUpdateStore((s) => {
        const j = s.jobs.find((x) => x.id === job.id)
        if (!j) return
        const b = { id: newId, label: `Bid ${(j.bids || []).length + 1} (Gemini draft)`, scope: j.description || '', materials: [], labor: 0, other: 0, createdAt: nowISO(), laborRate: Number(settings.defaultLaborRate) || 0, markupPct: Number(settings.defaultMarkupPct ?? 20) || 0, overheadPct: Number(settings.defaultOverheadPct) || 0, validUntil, bidDraft: { raw: text, parsed, createdAt: nowISO(), source: 'chat' } }
        j.bids = [...(j.bids || []), b]
        j.updatedAt = nowISO()
      })
      setNotice('Draft saved as a new bid on this job — open the job and check the Bids tab to review it. Nothing is accepted or final.')
    } catch (e) {
      setError('Applying that answer failed: ' + (e.message || e))
    } finally {
      setApplying('')
    }
  }

  return (
    <div className="page">
      <h1>{job ? `Ask Gemini — ${job.title || 'this job'}` : 'Ask Gemini'}</h1>
      {job && <p className="muted">Job-aware: the description, bids, materials, tools, and notes travel with your question so the advice is specific to this job.</p>}
      {!job && <p className="muted">General carpentry help — estimating, material lists, code questions, pricing, ad copy, how to fix something.</p>}

      {!settings.geminiApiKey && (
        <div className="kbd-note" style={{ marginBottom: 12 }}>
          <b>No Gemini key yet.</b> This uses your own free Gemini key — nothing is bundled in the app and there is no shared key.
          Get one free at Google AI Studio (aistudio.google.com → Get API key), then paste it in Settings → Gemini.
          <div className="row" style={{ marginTop: 8 }}><button className="small dark" onClick={goSettings}>Open Settings</button></div>
        </div>
      )}
      {error && <div className="kbd-note" style={{ marginBottom: 12, background: 'var(--red-bg)', borderColor: 'var(--red-line)' }}>{error}</div>}
      {notice && (
        <div className="kbd-note" style={{ marginBottom: 12, background: 'var(--green-bg)', borderColor: 'var(--green-line)' }}>
          {notice}
          {job && goJob && <div className="row" style={{ marginTop: 8 }}><button className="small dark" onClick={() => goJob(job.id)}>Open this job</button></div>}
        </div>
      )}

      <div className="chips">
        {PROMPT_CHIPS.map((c) => (
          <button key={c} className="chip" onClick={() => send(c)} disabled={busy || !settings.geminiApiKey}>{c}</button>
        ))}
      </div>

      <div className="chatbox">
        {history.length === 0 && <p className="muted">No questions yet. Tap a suggestion above or type your own.</p>}
        {history.map((m) => (
          <div key={m.id}>
            <div className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
            {m.role === 'model' && job && (
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="small dark" onClick={() => applyAnswer(m)} disabled={applying === m.id || !settings.geminiApiKey}>
                  {applying === m.id ? 'Applying…' : '✨ Apply this answer to the bid'}
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg ai">Thinking…</div>}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this job…" onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
        <button className="primary" onClick={() => send()} disabled={busy || !settings.geminiApiKey}>Ask</button>
      </div>
      {history.length > 0 && <button className="small" style={{ marginTop: 8 }} onClick={clearHistory}>Clear this chat history</button>}
      <p className="muted">Model: {settings.geminiModel || 'gemini-3.8-flash'} (free tier, changeable in Settings). Requests go straight from this phone to Google — no backend, no middleman.</p>
    </div>
  )
}
