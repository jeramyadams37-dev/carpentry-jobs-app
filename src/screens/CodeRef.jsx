import React, { useState } from 'react'
import { CODE_SECTIONS } from '../lib/codeRef.js'

export default function CodeRef() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const shown = CODE_SECTIONS.filter((s) => {
    if (!q.trim()) return true
    const hay = `${s.title} ${s.category} ${s.cite} ${s.summary} ${s.rules.map((r) => r.text + ' ' + r.cite).join(' ')}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })
  return (
    <div className="page">
      <h1>Building code</h1>
      <p className="muted">Plain-language residential rules a carpenter actually needs, with the section cited. <b>Reference only, not legal advice</b> — the local jurisdiction and the inspector on the job have the final say.</p>
      <div className="searchbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code — e.g. winder, guard, footing…" />
      </div>
      {shown.length === 0 && <p className="muted">Nothing matches that search.</p>}
      {shown.map((s) => (
        <div key={s.id} className="card">
          <button className="list-item" style={{ border: 'none', padding: 0, margin: 0 }} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <div className="row between"><span className="t">{s.title}</span><span className="pill bid">{s.cite}</span></div>
            <div className="s">{s.summary}</div>
          </button>
          {open === s.id && (
            <div style={{ marginTop: 10 }}>
              {s.rules.map((r, i) => (
                <p key={i}>• {r.text} <span className="muted">({r.cite})</span></p>
              ))}
            </div>
          )}
        </div>
      ))}
      <p className="muted">Link sections to a job from the job's Code tab — the job gets a checklist of the numbers that apply, and the job cannot be marked Done until it is checked off.</p>
    </div>
  )
}
