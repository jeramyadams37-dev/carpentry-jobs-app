// Pick a built-in job template — the job starts half-written: description,
// a starter bid (materials, labor hours), and a starter checklist. Everything
// is editable after creation, like any job.
import React from 'react'
import { JOB_TEMPLATES } from '../lib/templates.js'

export default function Templates({ onUse, onCancel }) {
  return (
    <div className="page">
      <h1>New job from template</h1>
      <p className="muted">A template pre-fills the description, a starter bid (materials and labor hours), and a starter checklist. Material prices come from your price book where they exist — the rest start at $0 to fill in on the Bids tab.</p>
      {JOB_TEMPLATES.map((t) => (
        <div key={t.id} className="card">
          <h2>{t.title}</h2>
          <p>{t.description}</p>
          <p className="muted">Scope: {t.scope}</p>
          <p className="muted">Starter bid: {t.laborHours}h labor • {t.materials.length} material lines • {t.checklist.length} checklist items</p>
          <button className="small primary" onClick={() => onUse(t)}>Use this template</button>
        </div>
      ))}
      <button onClick={onCancel}>Back to jobs</button>
    </div>
  )
}
