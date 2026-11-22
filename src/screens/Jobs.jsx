import React, { useState } from 'react'
import { money, fmtDate, STATUS_LABELS, bidTotal, acceptedBid } from '../lib/store.js'
import { StatusPill } from '../components/ui.jsx'

const FILTERS = ['all', 'enquiry', 'bid', 'accepted', 'scheduled', 'in-progress', 'done', 'follow-up', 'lost', 'cancelled']

export default function Jobs({ store, goJob, goNew, goTemplates }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const jobs = [...(store.jobs || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  const shown = jobs.filter((j) => {
    if (filter !== 'all' && j.status !== filter) return false
    if (q) {
      const hay = `${j.title} ${j.customerName} ${j.address} ${j.description}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })
  const groups = {}
  for (const j of shown) {
    ;(groups[j.status] = groups[j.status] || []).push(j)
  }
  return (
    <div className="page">
      <h1>Jobs</h1>
      <div className="searchbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, job, address…" />
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">No jobs match. Try another filter or start a new job.</p>}
      {Object.keys(groups).map((st) => (
        <div key={st}>
          <h2>{STATUS_LABELS[st]} ({groups[st].length})</h2>
          {groups[st].map((j) => {
            const bid = acceptedBid(j)
            return (
              <button key={j.id} className="list-item" onClick={() => goJob(j.id)}>
                <div className="row between"><span className="t">{j.title || 'Untitled job'}</span><StatusPill status={j.status} /></div>
                <div className="s">{j.customerName}{j.address ? ' • ' + j.address : ''}</div>
                <div className="s">{bid ? `Accepted bid ${money(bidTotal(bid))}` : (j.bids || []).length ? `${(j.bids || []).length} bid${(j.bids || []).length > 1 ? 's' : ''} — none accepted yet` : 'No bids yet'}{j.scheduledDate ? ` • ${fmtDate(j.scheduledDate)}` : ''}</div>
              </button>
            )
          })}
        </div>
      ))}
      <button className="primary block" onClick={goNew}>+ New job</button>
      <button className="block" style={{ marginTop: 8 }} onClick={goTemplates}>📋 New job from template</button>
    </div>
  )
}
