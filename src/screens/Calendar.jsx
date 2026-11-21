import React, { useState } from 'react'
import { fmtDate, todayISO, STATUS_LABELS } from '../lib/store.js'
import { StatusPill } from '../components/ui.jsx'

function monthDays(year, month) {
  const first = new Date(year, month, 1)
  const startDow = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

export default function Calendar({ store, goJob }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [sel, setSel] = useState(todayISO())
  const jobs = store.jobs || []

  function shift(dir) {
    setYm((p) => {
      let { y, m } = p
      m += dir
      if (m < 0) { m = 11; y -= 1 }
      if (m > 11) { m = 0; y += 1 }
      return { y, m }
    })
  }
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const cells = monthDays(ym.y, ym.m)
  const monthName = new Date(ym.y, ym.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function marksFor(iso) {
    const marks = []
    for (const j of jobs) {
      if (j.scheduledDate === iso && !['done', 'cancelled', 'lost'].includes(j.status)) marks.push({ k: 'sched', label: j.title || j.customerName })
      if (j.startedDate === iso) marks.push({ k: 'start', label: j.title || j.customerName })
      if (j.finishedDate === iso) marks.push({ k: 'fin', label: j.title || j.customerName })
      for (const f of j.followUps || []) if (f.dueDate === iso && !f.done) marks.push({ k: 'fup', label: f.title })
      for (const ins of j.inspections || []) if (ins.date === iso) marks.push({ k: 'insp', label: `${ins.type || 'Inspection'} — ${j.title || j.customerName}` })
      if (j.maintenance && j.maintenance.nextDueDate === iso) marks.push({ k: 'maint', label: `Maintenance — ${j.title || j.customerName}` })
    }
    return marks
  }

  const selJobs = jobs.filter((j) => [j.scheduledDate, j.startedDate, j.finishedDate].includes(sel))
  const selFups = jobs.flatMap((j) => (j.followUps || []).filter((f) => f.dueDate === sel).map((f) => ({ job: j, f })))
  const selInspections = jobs.flatMap((j) => (j.inspections || []).filter((i) => i.date === sel).map((i) => ({ job: j, i })))
  const selMaint = jobs.filter((j) => j.maintenance && j.maintenance.nextDueDate === sel)
  const upcomingFups = jobs.flatMap((j) => (j.followUps || []).filter((f) => !f.done && f.dueDate).map((f) => ({ job: j, f })))
    .sort((a, b) => String(a.f.dueDate).localeCompare(String(b.f.dueDate)))

  return (
    <div className="page">
      <h1>Calendar</h1>
      <div className="row between">
        <button className="small" onClick={() => shift(-1)}>← Prev</button>
        <b>{monthName}</b>
        <button className="small" onClick={() => shift(1)}>Next →</button>
      </div>
      <div className="cal" style={{ marginTop: 12 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="day empty" />
          const iso = isoOf(d)
          const marks = marksFor(iso)
          const isToday = iso === todayISO()
          return (
            <button key={i} className={`day ${isToday ? 'today' : ''} ${sel === iso ? 'sel' : ''}`} onClick={() => setSel(iso)}>
              {d.getDate()}
              <div>{marks.slice(0, 3).map((m, k) => <span key={k} className={`dot ${m.k}`} />)}</div>
            </button>
          )
        })}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        <span className="dot sched" /> Scheduled <span className="dot start" /> Started <span className="dot fin" /> Finished <span className="dot fup" /> Follow-up due <span className="dot insp" /> Inspection <span className="dot maint" /> Maintenance
      </p>

      <div className="card">
        <h2>{fmtDate(sel)}</h2>
        {selJobs.length === 0 && selFups.length === 0 && selInspections.length === 0 && selMaint.length === 0 && <p className="muted">Nothing on this day.</p>}
        {selJobs.map((j) => (
          <button key={j.id} className="list-item" onClick={() => goJob(j.id)}>
            <div className="row between"><span className="t">{j.title || 'Untitled job'}</span><StatusPill status={j.status} /></div>
            <div className="s">{j.customerName}{j.scheduledDate === sel ? ' • scheduled' : ''}{j.startedDate === sel ? ' • started' : ''}{j.finishedDate === sel ? ' • finished' : ''}</div>
          </button>
        ))}
        {selFups.map(({ job, f }) => (
          <p key={f.id}>⏰ {f.title} — {job.title || job.customerName}{f.done ? ' (done)' : ''}</p>
        ))}
        {selInspections.map(({ job, i }) => (
          <p key={i.id}>🏛️ {i.type || 'Inspection'} — {job.title || job.customerName} ({i.result})</p>
        ))}
        {selMaint.map((j) => (
          <p key={j.id}>🔁 Maintenance due — {j.title || j.customerName}: {j.maintenance?.notes || ''}</p>
        ))}
      </div>

      <div className="card">
        <h2>Follow-ups due</h2>
        {upcomingFups.length === 0 && <p className="muted">No follow-ups with due dates.</p>}
        {upcomingFups.slice(0, 10).map(({ job, f }) => (
          <p key={f.id}>{f.done ? '✓' : f.dueDate < todayISO() ? '⏰ OVERDUE — ' : '• '} {f.title} — {job.title || job.customerName} ({fmtDate(f.dueDate)})</p>
        ))}
      </div>

      <div className="card">
        <h2>Jobs by status</h2>
        {Object.keys(STATUS_LABELS).map((s) => {
          const n = jobs.filter((j) => j.status === s).length
          return n > 0 ? <p key={s}>{STATUS_LABELS[s]}: <b>{n}</b></p> : null
        })}
      </div>
    </div>
  )
}
