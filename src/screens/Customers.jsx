// Customer directory — derived from jobs, grouped by phone (or name).
// Lead source and notes are stored per customer; win rate and revenue
// are computed from their jobs. Repeat customers are flagged.
import React from 'react'
import { money, fmtDate, customerGroups, LEAD_SOURCES, CUSTOMER_TYPES } from '../lib/store.js'

export default function Customers({ store, onUpdateStore, goJob }) {
  const groups = customerGroups(store)

  function setMeta(key, patch) {
    onUpdateStore((s) => {
      s.customers = { ...(s.customers || {}), [key]: { ...((s.customers || {})[key] || {}), ...patch } }
    })
  }

  return (
    <div className="page">
      <h1>Customers ({groups.length})</h1>
      <p className="muted">Every customer you have ever quoted, with all their jobs. Lead source is how they found you — it feeds the win-rate picture.</p>
      {groups.length === 0 && <p className="muted">No customers yet — create a job and one appears here automatically.</p>}
      {groups.map((c) => (
        <div key={c.key} className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{c.name}</h2>
            {c.repeat && <span className="pill done">Repeat customer</span>}
          </div>
          <p className="muted">{c.phone}{c.address ? ' • ' + c.address : ''}</p>
          <p>{c.customerType ? `${CUSTOMER_TYPES.find((t) => t.id === c.customerType)?.label || c.customerType} • ` : ''}{c.jobs.length} job{c.jobs.length > 1 ? 's' : ''} • Won {c.won} • Lost {c.lost} • Win rate {c.winRate === null ? '—' : c.winRate + '%'} • Revenue <b className="money">{money(c.revenue)}</b></p>
          <div className="grid2">
            <div><label>Customer type</label>
              <select value={c.customerType || ''} onChange={(e) => setMeta(c.key, { customerType: e.target.value })}>
                <option value="">—</option>
                {CUSTOMER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label>Lead source</label>
              <select value={c.leadSource || ''} onChange={(e) => setMeta(c.key, { leadSource: e.target.value })}>
                <option value="">—</option>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Notes</label>
            <input value={c.notes || ''} onChange={(e) => setMeta(c.key, { notes: e.target.value })} placeholder="e.g. Prefers texting" />
          </div>
          <div style={{ marginTop: 8 }}>
            {c.jobs.map((j) => (
              <button key={j.id} className="list-item" onClick={() => goJob(j.id)}>
                <div className="row between"><span className="t">{j.title || 'Untitled job'}</span><span className="muted">{j.status}</span></div>
                <div className="s">{j.finishedDate ? 'Finished ' + fmtDate(j.finishedDate) : j.scheduledDate ? 'Scheduled ' + fmtDate(j.scheduledDate) : 'Created ' + fmtDate(j.createdAt)}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
