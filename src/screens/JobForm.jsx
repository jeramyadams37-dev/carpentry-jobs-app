import React, { useState } from 'react'
import { JOB_TYPES, LEAD_SOURCES, CUSTOMER_TYPES } from '../lib/store.js'

export default function JobForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    customerName: initial?.customerName || '',
    phone: initial?.phone || '',
    address: initial?.address || '',
    description: initial?.description || '',
    jobType: initial?.jobType || 'general',
    customerType: initial?.customerType || '',
    status: initial?.status || 'bid',
    scheduledDate: initial?.scheduledDate || '',
    leadSource: initial?.leadSource || '',
  })
  function set(k, v) { setF((p) => ({ ...p, [k]: v })) }
  return (
    <div className="page">
      <h1>{initial ? 'Edit job' : 'New job'}</h1>
      {!initial && (
        <div>
          <label>Stage</label>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="enquiry">Enquiry — someone asked, no quote yet</option>
            <option value="bid">Bid — ready to quote</option>
          </select>
          <p className="muted">An enquiry lives on the home screen until you quote it — convert it to a bid in one tap on the job screen.</p>
        </div>
      )}
      <label>Job title</label>
      <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Rebuild back deck stairs" />
      <label>Customer name</label>
      <input value={f.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Who is paying?" />
      <label>Customer type</label>
      <select value={f.customerType} onChange={(e) => set('customerType', e.target.value)}>
        <option value="">—</option>
        {CUSTOMER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <p className="muted">Builder work pays less per hour than direct — reports split by this so you can see it.</p>
      <label>Customer phone</label>
      <input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone number" inputMode="tel" />
      <label>Job address</label>
      <input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, town" />
      <label>Job type</label>
      <select value={f.jobType} onChange={(e) => set('jobType', e.target.value)}>
        {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <label>How did this customer find you? (lead source)</label>
      <select value={f.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
        <option value="">—</option>
        {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label>Description / scope</label>
      <textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What needs doing?" />
      <label>Scheduled date (optional)</label>
      <input type="date" value={f.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="primary" style={{ flex: 1 }} disabled={!f.title.trim() && !f.customerName.trim()} onClick={() => onSave(f)}>Save job</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>Bids, materials, tools, photos, and notes are added on the job screen after you save.</p>
    </div>
  )
}
