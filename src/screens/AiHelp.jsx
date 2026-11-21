import React, { useState } from 'react'
import { askGemini, jobContextBlock, PROMPT_CHIPS } from '../lib/gemini.js'
import { nowISO, uid } from '../lib/store.js'

export default function AiHelp({ store, job, onUpdateStore, goSettings }) {
  const settings = store.settings || {}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      {error && <div className="kbd-note" style={{ marginBottom: 12, background: '#fee2e2', borderColor: '#fca5a5' }}>{error}</div>}

      <div className="chips">
        {PROMPT_CHIPS.map((c) => (
          <button key={c} className="chip" onClick={() => send(c)} disabled={busy || !settings.geminiApiKey}>{c}</button>
        ))}
      </div>

      <div className="chatbox">
        {history.length === 0 && <p className="muted">No questions yet. Tap a suggestion above or type your own.</p>}
        {history.map((m) => (
          <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
        ))}
        {busy && <div className="msg ai">Thinking…</div>}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this job…" onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
        <button className="primary" onClick={() => send()} disabled={busy || !settings.geminiApiKey}>Ask</button>
      </div>
      {history.length > 0 && <button className="small" style={{ marginTop: 8 }} onClick={clearHistory}>Clear this chat history</button>}
      <p className="muted">Model: {settings.geminiModel || 'gemini-2.0-flash'} (free tier, changeable in Settings). Requests go straight from this phone to Google — no backend, no middleman.</p>
    </div>
  )
}
