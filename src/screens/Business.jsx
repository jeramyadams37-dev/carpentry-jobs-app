// Business plan & setup — one screen, not two.
// The full business plan as a living reference, the Startup-to-Finish
// blueprint as a trackable checklist (merged with the compliance /
// paperwork items — insurance lines carry expiry dates and reminders),
// editable budget tables, and 30/60/90-day milestones. Exports the whole
// plan as a printable PDF. Checklist, not legal advice.
import React, { useRef, useState } from 'react'
import { money, fmtDate, nowISO, uid, businessProgress, complianceExpiringSoon } from '../lib/store.js'
import { PLAN_SECTIONS } from '../lib/planContent.js'
import { businessPlanPDF } from '../lib/pdf.js'
import { saveToDownloads, shareFile } from '../lib/files.js'

export default function Business({ store, onUpdateStore, toast }) {
  const [tab, setTab] = useState('plan')
  const [planSection, setPlanSection] = useState('summary')
  const [licCity, setLicCity] = useState('')
  const [licNumber, setLicNumber] = useState('')
  const [pendingCoi, setPendingCoi] = useState(null)
  const coiInputRef = useRef(null)
  const business = store.business || { blueprint: [], budget: { startup: [], monthly: [] }, milestones: [] }
  const prog = businessProgress(store)
  const expiring = complianceExpiringSoon(store, 30)
  const section = PLAN_SECTIONS.find((s) => s.id === planSection) || PLAN_SECTIONS[0]

  function updBusiness(fn) {
    onUpdateStore((s) => {
      if (!s.business) s.business = { blueprint: [], budget: { startup: [], monthly: [] }, milestones: [] }
      fn(s.business)
    })
  }
  function toggleBlueprint(phaseId, itemId) {
    updBusiness((b) => {
      const item = (b.blueprint || []).find((p) => p.id === phaseId)?.items?.find((i) => i.id === itemId)
      if (item) { item.done = !item.done; item.doneAt = item.done ? nowISO() : '' }
    })
  }
  function setBlueprintExpiry(phaseId, itemId, date) {
    updBusiness((b) => {
      const item = (b.blueprint || []).find((p) => p.id === phaseId)?.items?.find((i) => i.id === itemId)
      if (item) item.expiryDate = date
    })
  }
  // Certificate of insurance (COI) attach on insurance lines — the
  // document the builder or customer asks for before work starts.
  function attachCoi(phaseId, itemId) {
    setPendingCoi({ phaseId, itemId })
    if (coiInputRef.current) coiInputRef.current.click()
  }
  function onCoiFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file || !pendingCoi) return
    const { phaseId, itemId } = pendingCoi
    const r = new FileReader()
    r.onload = () => {
      updBusiness((b) => {
        const item = (b.blueprint || []).find((p) => p.id === phaseId)?.items?.find((i) => i.id === itemId)
        if (item) item.coi = { name: file.name, dataUrl: String(r.result), attachedAt: nowISO() }
      })
      toast('COI attached: ' + file.name)
    }
    r.readAsDataURL(file)
    e.target.value = ''
    setPendingCoi(null)
  }
  async function downloadCoi(coi) {
    try {
      const b64 = (coi.dataUrl || '').includes(',') ? coi.dataUrl.split(',')[1] : coi.dataUrl
      const where = await saveToDownloads(coi.name, b64, 'application/pdf')
      toast(where)
    } catch (err) { toast(err.message || 'Download failed.') }
  }
  function removeCoi(phaseId, itemId) {
    updBusiness((b) => {
      const item = (b.blueprint || []).find((p) => p.id === phaseId)?.items?.find((i) => i.id === itemId)
      if (item) delete item.coi
    })
  }
  // Municipal license numbers, per city — auto-inserted on quotes,
  // invoices, and contracts.
  const licenses = (store.settings?.municipalLicenses || [])
  function addLicense() {
    if (!licCity.trim() || !licNumber.trim()) { toast('Enter a city and a license number.'); return }
    onUpdateStore((s) => { s.settings = { ...(s.settings || {}), municipalLicenses: [...(s.settings?.municipalLicenses || []), { id: uid(), city: licCity.trim(), number: licNumber.trim() }] } })
    setLicCity(''); setLicNumber('')
  }
  function removeLicense(id) {
    onUpdateStore((s) => { s.settings = { ...(s.settings || {}), municipalLicenses: (s.settings?.municipalLicenses || []).filter((l) => l.id !== id) } })
  }
  function setBudgetRow(kind, id, amount) {
    updBusiness((b) => {
      const row = (b.budget?.[kind] || []).find((r) => r.id === id)
      if (row) row.amount = amount
    })
  }
  function toggleMilestone(id) {
    updBusiness((b) => {
      const m = (b.milestones || []).find((x) => x.id === id)
      if (m) { m.done = !m.done; m.doneAt = m.done ? nowISO() : '' }
    })
  }
  async function exportPlanPdf() {
    try {
      const out = businessPlanPDF(store, store.settings || {})
      const where = await saveToDownloads(out.filename, out.base64, out.mime)
      toast(`${out.filename} — ${where}`)
    } catch (e) { toast('PDF failed: ' + (e.message || e)) }
  }
  async function sharePlanPdf() {
    try {
      const out = businessPlanPDF(store, store.settings || {})
      await shareFile(out.filename, out.base64, out.mime, `${store.settings?.businessName || 'AtotheI Carpentry'} — Business Plan`)
      toast('Shared.')
    } catch (e) { toast(e.message || 'Share failed.') }
  }

  const budgetTotal = (rows) => (rows || []).reduce((s, r) => s + (r.amount === '' ? 0 : (Number(r.amount) || 0)), 0)

  return (
    <div className="page">
      <h1>Business plan &amp; setup</h1>
      <p className="muted">The whole plan lives here — read it, check the steps off, fix the numbers to your real ones, and export it as a PDF when you need it on paper.</p>

      <div className="card">
        <h2>Progress</h2>
        <p>Blueprint: <b>{prog.blueprintDone}/{prog.blueprintTotal} done</b> • Milestones: <b>{prog.milestonesDone}/{prog.milestonesTotal} done</b></p>
        {expiring.length > 0 && expiring.map(({ item, phase, expiry, daysLeft }) => (
          <p key={item.id}>⚠️ <b>{item.label}</b> expires {fmtDate(expiry)} ({daysLeft} day{daysLeft === 1 ? '' : 's'} left) — {phase}</p>
        ))}
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="small primary" onClick={exportPlanPdf}>Business Plan PDF</button>
          <button className="small" onClick={sharePlanPdf}>Share plan PDF</button>
        </div>
      </div>

      <div className="chips">
        {[['plan', 'The plan'], ['checklist', 'Checklist'], ['budget', 'Budget'], ['milestones', 'Milestones']].map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'plan' && (
        <div>
          <div className="chips">
            {PLAN_SECTIONS.map((s) => (
              <button key={s.id} className={`chip ${planSection === s.id ? 'on' : ''}`} onClick={() => setPlanSection(s.id)}>{s.title}</button>
            ))}
          </div>
          <div className="card">
            <h2>{section.title}</h2>
            {section.body.map((para, i) => <p key={i}>{para}</p>)}
          </div>
          <p className="muted">Illinois note: general carpentry and remodeling are regulated at the city/county level, not by a state license. Roofing and plumbing have state licenses. Confirm licensing, insurance, and tax items with your local licensing office and an accountant. This plan is a reference, not legal advice.</p>
        </div>
      )}

      {tab === 'checklist' && (
        <div>
          <p className="muted">Startup-to-Finish blueprint. Insurance lines carry an expiry date — set it and a reminder is scheduled before it runs out. Checklist, not legal advice.</p>
          {(business.blueprint || []).map((phase) => {
            const items = phase.items || []
            const done = items.filter((i) => i.done).length
            return (
              <div key={phase.id} className="card">
                <h2>{phase.title} — {done}/{items.length} done</h2>
                {items.map((item) => (
                  <div key={item.id} className="checkline">
                    <input type="checkbox" checked={!!item.done} onChange={() => toggleBlueprint(phase.id, item.id)} />
                    <div style={{ flex: 1 }}>
                      <span style={item.done ? { textDecoration: 'line-through' } : {}}>{item.label}</span>
                      {item.detail && <div className="muted">{item.detail}</div>}
                      {item.done && item.doneAt && <div className="muted">Done {fmtDate(item.doneAt)}</div>}
                      {item.hasExpiry && (
                        <div className="row" style={{ marginTop: 6 }}>
                          <label style={{ margin: 0 }}>Expires</label>
                          <input type="date" value={item.expiryDate || ''} onChange={(e) => setBlueprintExpiry(phase.id, item.id, e.target.value)} />
                        </div>
                      )}
                      {item.hasExpiry && (
                        <div className="row wrap" style={{ marginTop: 6 }}>
                          {item.coi ? (
                            <span className="muted">COI attached: <b>{item.coi.name}</b> ({fmtDate(item.coi.attachedAt)}) <button className="small" onClick={() => downloadCoi(item.coi)}>Save</button> <button className="small" onClick={() => removeCoi(phase.id, item.id)}>Remove</button></span>
                          ) : (
                            <button className="small" onClick={() => attachCoi(phase.id, item.id)}>Attach COI (certificate of insurance)</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          <div className="card">
            <h2>Municipal licenses</h2>
            <p className="muted">License numbers per city — they print on quotes, invoices, and contracts automatically. General carpentry in Illinois is regulated at the city/county level, not the state.</p>
            {licenses.length === 0 && <p className="muted">No licenses stored yet.</p>}
            {licenses.map((l) => (
              <div key={l.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>{l.city}</b> — #{l.number}</span>
                <button className="small" onClick={() => removeLicense(l.id)}>✕</button>
              </div>
            ))}
            <div className="row wrap" style={{ marginTop: 8 }}>
              <input value={licCity} onChange={(e) => setLicCity(e.target.value)} placeholder="City (e.g. Springfield)" />
              <input value={licNumber} onChange={(e) => setLicNumber(e.target.value)} placeholder="License number" />
              <button className="small primary" onClick={addLicense}>Add license</button>
            </div>
          </div>
          <input ref={coiInputRef} type="file" style={{ display: 'none' }} onChange={onCoiFile} />
        </div>
      )}

      {tab === 'budget' && (
        <div>
          <p className="muted">Edit any figure — replace the typical / planning numbers with your real ones. The vehicle row is blank on purpose: a running work vehicle is the gating item, and any price would be invented.</p>
          <div className="card">
            <h2>Startup budget (lean)</h2>
            {(business.budget?.startup || []).map((r) => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="row between"><span>{r.label}</span>
                  <input type="number" value={r.amount} onChange={(e) => setBudgetRow('startup', r.id, e.target.value)} placeholder="—" inputMode="decimal" style={{ maxWidth: 120, textAlign: 'right' }} />
                </div>
                {r.note && <div className="muted">{r.note}</div>}
              </div>
            ))}
            <p style={{ marginTop: 10 }}>Startup total (excl. vehicle): <b className="money">{money(budgetTotal(business.budget?.startup))}</b></p>
          </div>
          <div className="card">
            <h2>Monthly operating costs</h2>
            {(business.budget?.monthly || []).map((r) => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="row between"><span>{r.label}</span>
                  <input type="number" value={r.amount} onChange={(e) => setBudgetRow('monthly', r.id, e.target.value)} placeholder="—" inputMode="decimal" style={{ maxWidth: 120, textAlign: 'right' }} />
                </div>
                {r.note && <div className="muted">{r.note}</div>}
              </div>
            ))}
            <p style={{ marginTop: 10 }}>Monthly total: <b className="money">{money(budgetTotal(business.budget?.monthly))}</b> / month</p>
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <div>
          <p className="muted">30 / 60 / 90-day milestones. Check them off as they happen.</p>
          {['30', '60', '90'].map((horizon) => {
            const list = (business.milestones || []).filter((m) => m.horizon === horizon)
            const done = list.filter((m) => m.done).length
            return (
              <div key={horizon} className="card">
                <h2>{horizon} days — {done}/{list.length} done</h2>
                {list.map((m) => (
                  <div key={m.id} className="checkline">
                    <input type="checkbox" checked={!!m.done} onChange={() => toggleMilestone(m.id)} />
                    <div style={{ flex: 1 }}>
                      <span style={m.done ? { textDecoration: 'line-through' } : {}}>{m.label}</span>
                      {m.done && m.doneAt && <div className="muted">Done {fmtDate(m.doneAt)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
