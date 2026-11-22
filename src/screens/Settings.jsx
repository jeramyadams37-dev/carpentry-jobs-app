import React, { useRef, useState } from 'react'
import { exportJSON, parseImport, publicStatusFeed, fmtDateTime, quickbooksCSV } from '../lib/store.js'
import { looksLikePOBox } from '../lib/hrra.js'
import { saveToDownloads, shareFile, copyText } from '../lib/files.js'
import { askGemini } from '../lib/gemini.js'
import { requestNotificationPermission, scheduleAllReminders } from '../lib/notify.js'
import { listAutoBackups, readLatestBackup } from '../lib/backup.js'
import { Confirm } from '../components/ui.jsx'

export default function Settings({ store, onUpdateStore, toast }) {
  const settings = store.settings || {}
  const [confirm, setConfirm] = useState(null)
  const [testResult, setTestResult] = useState('')
  const [notifyResult, setNotifyResult] = useState('')
  const [autoBackups, setAutoBackups] = useState([])
  const importRef = useRef(null)

  function set(k, v) {
    onUpdateStore((s) => { s.settings = { ...(s.settings || {}), [k]: v } })
  }

  async function exportBackup() {
    try {
      const json = exportJSON(store)
      const b64 = btoa(unescape(encodeURIComponent(json)))
      const stamp = new Date().toISOString().slice(0, 10)
      const where = await saveToDownloads(`bid-to-finish-backup_${stamp}.json`, b64, 'application/json')
      toast('Backup — ' + where)
    } catch (e) { toast('Backup failed: ' + (e.message || e)) }
  }

  async function shareBackup() {
    try {
      const json = exportJSON(store)
      const b64 = btoa(unescape(encodeURIComponent(json)))
      const stamp = new Date().toISOString().slice(0, 10)
      await shareFile(`bid-to-finish-backup_${stamp}.json`, b64, 'application/json', 'Bid to Finish backup')
      toast('Backup shared.')
    } catch (e) { toast('Share failed: ' + (e.message || e)) }
  }

  async function exportStatusFeed() {
    try {
      const feed = publicStatusFeed(store)
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(feed, null, 2))))
      const where = await saveToDownloads('jobs.json', b64, 'application/json')
      toast(`jobs.json — ${where} — only code, first name, job type, status. No private data. Upload it next to customer-status.html on GitHub Pages.`)
    } catch (e) { toast('Export failed: ' + (e.message || e)) }
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const imported = parseImport(String(r.result))
        setConfirm({
          title: 'Restore this backup?',
          body: `This replaces everything in the app with the backup (${imported.jobs.length} jobs). Export a backup first if you want to keep what is here now.`,
          ok: 'Restore backup',
          fn: () => onUpdateStore((s) => { s.jobs = imported.jobs; s.settings = imported.settings; s.aiGeneral = imported.aiGeneral; s.customers = imported.customers || {}; s.lastBackupAt = imported.lastBackupAt || '' }),
        })
      } catch (err) {
        toast('Import failed: ' + err.message)
      }
    }
    r.readAsText(file)
    e.target.value = ''
  }

  async function testKey() {
    setTestResult('Testing…')
    try {
      const answer = await askGemini(settings.geminiApiKey, settings.geminiModel, [{ role: 'user', text: 'Reply with just the word OK.' }])
      setTestResult('Key works. Gemini said: ' + answer.slice(0, 80))
    } catch (e) {
      setTestResult('Key test failed: ' + e.message)
    }
  }

  async function enableNotifications() {
    const res = await requestNotificationPermission()
    if (!res.granted) { setNotifyResult('Notifications not on: ' + res.reason); return }
    set('notificationsEnabled', true)
    const r = await scheduleAllReminders(store)
    setNotifyResult(r.scheduled > 0 ? `Notifications on — ${r.scheduled} reminder(s) scheduled.` : 'Notifications on — nothing due right now.')
  }

  async function refreshAutoBackups() {
    setAutoBackups(await listAutoBackups())
  }

  async function restoreLatestAuto() {
    try {
      const { file, imported } = await readLatestBackup()
      setConfirm({
        title: 'Restore automatic backup?',
        body: `This replaces everything in the app with ${file} (${imported.jobs.length} jobs). Export a backup first if you want to keep what is here now.`,
        ok: 'Restore backup',
        fn: () => onUpdateStore((s) => { s.jobs = imported.jobs; s.settings = imported.settings; s.aiGeneral = imported.aiGeneral; s.customers = imported.customers || {}; s.lastBackupAt = imported.lastBackupAt || '' }),
      })
    } catch (e) {
      toast('Restore failed: ' + e.message)
    }
  }

  const totalBytes = (() => {
    try { return Math.round((localStorage.getItem('carpentry-jobs-v1') || '').length / 1024) } catch (e) { return 0 }
  })()

  return (
    <div className="page">
      <h1>Settings &amp; data</h1>

      <div className="card">
        <h2>Business (used on PDFs and ads)</h2>
        <label>Business name</label>
        <input value={settings.businessName || ''} onChange={(e) => set('businessName', e.target.value)} />
        <label>Phone</label>
        <input value={settings.businessPhone || ''} onChange={(e) => set('businessPhone', e.target.value)} inputMode="tel" />
        <label>Email</label>
        <input value={settings.businessEmail || ''} onChange={(e) => set('businessEmail', e.target.value)} inputMode="email" />
        <label>Physical business address</label>
        <input value={settings.businessAddress || ''} onChange={(e) => set('businessAddress', e.target.value)} placeholder="Street address, city, IL ZIP" />
        {looksLikePOBox(settings.businessAddress) && <p style={{ color: '#b45309' }}>⚠️ This looks like a P.O. Box — the Illinois HRRA requires a physical business address on the contract.</p>}
        <p className="muted">Printed on contracts (HRRA requires it) and on quotes and invoices. It must be a physical address, not a P.O. Box.</p>
        <label>Default labor rate ($/hr)</label>
        <input type="number" value={settings.defaultLaborRate ?? 65} onChange={(e) => set('defaultLaborRate', e.target.value)} inputMode="decimal" />
        <p className="muted">Used for clocked hours when a job has no accepted bid rate yet. A bid's own rate always wins over this.</p>
        <label>Google review link</label>
        <input value={settings.googleReviewUrl || ''} onChange={(e) => set('googleReviewUrl', e.target.value.trim())} placeholder="https://g.page/r/… or your Google Business review link" />
        <p className="muted">After a good job, the closeout screen offers a one-tap review request by text with this link.</p>
      </div>

      <div className="card">
        <h2>Pricing defaults (estimate builder)</h2>
        <p className="muted">New bids start with these. Markup default 20% is inside the usual 15–30% range for materials. Minimum day rate warns you on a bid below it — a small job still costs a setup.</p>
        <div className="grid2">
          <div><label>Minimum day rate ($, 0 = off)</label><input type="number" value={settings.minDayRate ?? 0} onChange={(e) => set('minDayRate', e.target.value)} inputMode="decimal" /></div>
          <div><label>Default overhead rate (%)</label><input type="number" value={settings.defaultOverheadPct ?? 0} onChange={(e) => set('defaultOverheadPct', e.target.value)} inputMode="decimal" /></div>
          <div><label>Default materials markup (%)</label><input type="number" value={settings.defaultMarkupPct ?? 20} onChange={(e) => set('defaultMarkupPct', e.target.value)} inputMode="decimal" /></div>
          <div><label>Quote valid for (days)</label><input type="number" value={settings.quoteValidityDays ?? 30} onChange={(e) => set('quoteValidityDays', e.target.value)} inputMode="numeric" /></div>
          <div><label>Retainage on progress billing (%)</label><input type="number" value={settings.retainagePct ?? 10} onChange={(e) => set('retainagePct', e.target.value)} inputMode="decimal" /></div>
        </div>
        <p className="muted">Retainage is held back from each progress payment (default 10%) and released at completion, with the final walkthrough. Per-job retainage can be changed on the job's Money tab.</p>
      </div>

      <div className="card">
        <h2>Illinois sales tax</h2>
        <p className="muted">Materials sold to the customer are taxable; installation labor is not. Each material line on a bid is marked taxable or not. The rate is the Illinois 6.25% state base plus your municipality's local rate, which you enter — the app does not look rates up (no backend). Check your local rate with your municipality or the Illinois Department of Revenue.</p>
        <div className="grid2">
          <div><label>State base rate (%)</label><input type="number" value={settings.taxStateRate ?? 6.25} onChange={(e) => set('taxStateRate', e.target.value)} inputMode="decimal" /></div>
          <div><label>Local rate — your municipality (%)</label><input type="number" value={settings.taxLocalRate ?? 0} onChange={(e) => set('taxLocalRate', e.target.value)} inputMode="decimal" /></div>
        </div>
        <p>Total rate charged on taxable materials: <b>{((Number(settings.taxStateRate ?? 6.25) || 0) + (Number(settings.taxLocalRate) || 0)).toFixed(2)}%</b></p>
      </div>

      <div className="card">
        <h2>Reminders (local notifications)</h2>
        <p className="muted">Follow-ups due, overdue invoices, warranty expiry (7 days before), inspections (day before), recurring maintenance. Scheduled when the app opens — open the app once a day and they stay fresh. No account, no server.</p>
        <div className="row wrap">
          <button className="small dark" onClick={enableNotifications}>Enable reminders</button>
          <button className="small" onClick={async () => { const r = await scheduleAllReminders(store); setNotifyResult(r.scheduled > 0 ? `${r.scheduled} reminder(s) scheduled.` : 'Nothing due right now' + (r.reason ? ' (' + r.reason + ')' : '') + '.') }}>Refresh reminders now</button>
        </div>
        <div className="checkline">
          <input type="checkbox" checked={settings.notificationsEnabled !== false} onChange={(e) => set('notificationsEnabled', e.target.checked)} />
          <div><b>Reminders on</b><div className="muted">Turn off to stop all scheduled reminders.</div></div>
        </div>
        {notifyResult && <p style={{ marginTop: 8 }}>{notifyResult}</p>}
      </div>

      <div className="card">
        <h2>Gemini AI — your key, your phone</h2>
        <p className="muted">Bring your own key. It is stored on this device only and is never sent anywhere except Google's Gemini API when you ask a question. No key is bundled in the app.</p>
        <label>Gemini API key</label>
        <input type="password" value={settings.geminiApiKey || ''} onChange={(e) => set('geminiApiKey', e.target.value.trim())} placeholder="Paste your key here" autoComplete="off" />
        <label>Model (free tier default)</label>
        <input value={settings.geminiModel || ''} onChange={(e) => set('geminiModel', e.target.value.trim())} placeholder="gemini-3.8-flash" />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="small dark" onClick={testKey} disabled={!settings.geminiApiKey}>Test key</button>
          <button className="small" onClick={async () => toast(await copyText('https://aistudio.google.com/'))}>Copy AI Studio link</button>
        </div>
        {testResult && <p style={{ marginTop: 8 }}>{testResult}</p>}
        <p className="muted">How to get a free key: open Google AI Studio (aistudio.google.com), sign in, tap "Get API key", create one, paste it here. Free tier covers the flash model for this kind of use.</p>
      </div>

      <div className="card">
        <h2>Customer status page (v2)</h2>
        <p className="muted">Free setup: the status page + jobs.json go on GitHub Pages, and one Google Form collects feedback with the job code as a field. The app exports jobs.json — you upload it when a job moves. The public page shows only first name, job type, and status. A code is not a password.</p>
        <label>Status page URL</label>
        <input value={settings.statusPageUrl || ''} onChange={(e) => set('statusPageUrl', e.target.value.trim())} placeholder="https://yourname.github.io/carpentry-jobs-app/customer-status.html" />
        <label>Feedback form URL (Google Form)</label>
        <input value={settings.feedbackFormUrl || ''} onChange={(e) => set('feedbackFormUrl', e.target.value.trim())} placeholder="https://forms.gle/…" />
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="small primary" onClick={exportStatusFeed}>Export public status feed (jobs.json)</button>
        </div>
        <p className="muted">The Google Form must have a "Job code" field so answers can be matched back to the job. Copy feedback from the form's Sheet into the app by hand for now — there is no backend in v1.</p>
      </div>

      <div className="card">
        <h2>Backup &amp; restore</h2>
        <p className="muted">Your jobs live only on this phone. Export a backup regularly — it is the only copy if the phone is lost. Stored data right now: about {totalBytes} KB.</p>
        <p className="muted">Automatic backup: once a day when the app opens, a dated backup is saved to Documents/carpentry-jobs-backups (last 7 kept). Last automatic backup: <b>{store.lastBackupAt ? fmtDateTime(store.lastBackupAt) : 'never yet'}</b>.</p>
        <div className="row wrap">
          <button className="primary" onClick={exportBackup}>Export backup (JSON)</button>
          <button onClick={shareBackup}>Share backup</button>
          <button onClick={() => importRef.current && importRef.current.click()}>Import / restore</button>
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="small" onClick={refreshAutoBackups}>List automatic backups</button>
          <button className="small" onClick={restoreLatestAuto}>Restore latest automatic backup</button>
        </div>
        {autoBackups.length > 0 && <p className="muted" style={{ marginTop: 8 }}>{autoBackups.join(', ')}</p>}
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
        <p className="muted">Google Drive sync is a follow-up, not v1 — for now the share sheet above can send a backup straight to Drive.</p>
      </div>

      <div className="card">
        <h2>About</h2>
        <p className="muted">Bid to Finish v1.2.0 — AtotheI. Local-first, offline, no account, no backend. Contracts are draft templates, not legal advice. Code reference is reference only — the local inspector has the final say. Paid ads are not in v1; the ad screen makes post-ready drafts for Facebook.</p>
        <button className="danger" onClick={() => setConfirm({ title: 'Delete ALL data?', body: 'Every job, note, photo, and setting is wiped from this phone. Export a backup first — this cannot be undone.', ok: 'Delete everything', fn: () => onUpdateStore((s) => { s.jobs = []; s.aiGeneral = [] }) })}>Delete all data</button>
      </div>

      {confirm && <Confirm title={confirm.title} body={confirm.body} okLabel={confirm.ok} onOk={() => { const f = confirm.fn; setConfirm(null); f(); toast('Done.') }} onCancel={() => setConfirm(null)} />}
    </div>
  )
}
