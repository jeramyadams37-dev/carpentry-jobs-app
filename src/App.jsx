import React, { useEffect, useRef, useState } from 'react'
import { loadStore, saveStore, newJob, nowISO } from './lib/store.js'
import { checklistForJob } from './lib/codeRef.js'
import { autoBackupIfDue } from './lib/backup.js'
import { scheduleAllReminders } from './lib/notify.js'
import { useToast } from './components/ui.jsx'
import Home from './screens/Home.jsx'
import Jobs from './screens/Jobs.jsx'
import JobForm from './screens/JobForm.jsx'
import JobDetail from './screens/JobDetail.jsx'
import Calendar from './screens/Calendar.jsx'
import AiHelp from './screens/AiHelp.jsx'
import CodeRef from './screens/CodeRef.jsx'
import Settings from './screens/Settings.jsx'
import Reports from './screens/Reports.jsx'
import Customers from './screens/Customers.jsx'
import Business from './screens/Business.jsx'

const NAV = [
  { id: 'home', label: 'Home', ico: '🏠' },
  { id: 'jobs', label: 'Jobs', ico: '📋' },
  { id: 'calendar', label: 'Calendar', ico: '📅' },
  { id: 'ai', label: 'AI Help', ico: '🤖' },
  { id: 'more', label: 'More', ico: '⋯' },
]

export default function App() {
  const [store, setStore] = useState(() => loadStore())
  const [screen, setScreen] = useState({ name: 'home' })
  const toast = useToast()
  const didAutoBackup = useRef(false)

  useEffect(() => { saveStore(store) }, [store])

  // Daily automatic backup (once per app open) + refresh reminders.
  useEffect(() => {
    if (didAutoBackup.current) return
    didAutoBackup.current = true
    ;(async () => {
      try {
        const res = await autoBackupIfDue(loadStore())
        if (res.done) {
          setStore((prev) => ({ ...prev, lastBackupAt: res.at }))
        }
      } catch (e) { /* backup failure never blocks the app */ }
      try { await scheduleAllReminders(loadStore()) } catch (e) { /* reminders are best-effort */ }
    })()
  }, [])

  function updateStore(fn) {
    setStore((prev) => {
      const next = structuredClone(prev)
      fn(next)
      saveStore(next)
      return next
    })
  }

  function updateJob(jobId, fn) {
    updateStore((s) => {
      const j = s.jobs.find((x) => x.id === jobId)
      if (j) fn(j)
    })
  }

  function createJob(fields) {
    const job = newJob((store.jobs || []).map((j) => j.jobCode))
    Object.assign(job, fields)
    job.codeChecklist = checklistForJob(job)
    updateStore((s) => { s.jobs = [job, ...(s.jobs || [])] })
    setScreen({ name: 'job', jobId: job.id })
    toast.show('Job created. Add bids, materials, and photos on the job screen.')
  }

  function deleteJob(jobId) {
    updateStore((s) => { s.jobs = (s.jobs || []).filter((x) => x.id !== jobId) })
    setScreen({ name: 'jobs' })
    toast.show('Job deleted.')
  }

  const job = screen.jobId ? (store.jobs || []).find((j) => j.id === screen.jobId) : null
  const aiJob = screen.aiJobId ? (store.jobs || []).find((j) => j.id === screen.aiJobId) : null
  const editJob = screen.editJobId ? (store.jobs || []).find((j) => j.id === screen.editJobId) : null

  function go(name, extra) { setScreen({ name, ...(extra || {}) }) }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🔨 Carpentry Jobs</h1>
        <div className="sub">AtotheI • bid to finish • on this phone only</div>
      </div>

      {screen.name === 'home' && (
        <Home
          store={store}
          goJob={(id) => go('job', { jobId: id })}
          goNew={() => go('jobform')}
          goCalendar={() => go('calendar')}
          goAi={() => go('ai')}
          goReports={() => go('reports')}
          goCustomers={() => go('customers')}
          goBusiness={() => go('business')}
        />
      )}

      {screen.name === 'jobs' && (
        <Jobs store={store} goJob={(id) => go('job', { jobId: id })} goNew={() => go('jobform')} />
      )}

      {screen.name === 'jobform' && (
        <JobForm
          initial={editJob || null}
          onSave={(fields) => {
            if (editJob) {
              updateJob(editJob.id, (d) => { Object.assign(d, fields); d.codeChecklist = checklistForJob({ ...d, ...fields }) })
              setScreen({ name: 'job', jobId: editJob.id })
            } else {
              createJob(fields)
            }
          }}
          onCancel={() => setScreen(editJob ? { name: 'job', jobId: editJob.id } : { name: 'jobs' })}
        />
      )}

      {screen.name === 'job' && job && (
        <JobDetail
          job={job}
          store={store}
          onUpdate={(fn) => updateJob(job.id, fn)}
          onUpdateStore={updateStore}
          onDelete={() => deleteJob(job.id)}
          onEdit={() => go('jobform', { editJobId: job.id })}
          goBack={() => go('jobs')}
          goAi={(jobId) => go('ai', { aiJobId: jobId })}
          toast={toast.show}
          onCreateJob={(fields) => createJob(fields)}
        />
      )}
      {screen.name === 'job' && !job && (
        <div className="page"><p>That job is gone (maybe deleted).</p><button onClick={() => go('jobs')}>Back to jobs</button></div>
      )}

      {screen.name === 'calendar' && <Calendar store={store} goJob={(id) => go('job', { jobId: id })} />}

      {screen.name === 'ai' && (
        <AiHelp store={store} job={aiJob || null} onUpdateStore={updateStore} goSettings={() => go('settings')} />
      )}

      {screen.name === 'code' && <CodeRef />}

      {screen.name === 'reports' && <Reports store={store} toast={toast.show} />}

      {screen.name === 'customers' && (
        <Customers store={store} onUpdateStore={updateStore} goJob={(id) => go('job', { jobId: id })} />
      )}

      {screen.name === 'business' && (
        <Business store={store} onUpdateStore={updateStore} toast={toast.show} />
      )}

      {screen.name === 'settings' && (
        <Settings store={store} onUpdateStore={updateStore} toast={toast.show} />
      )}

      {screen.name === 'more' && (
        <div className="page">
          <h1>More</h1>
          <div className="card">
            <button className="list-item" onClick={() => go('code')}>
              <div className="t">📖 Building code reference</div>
              <div className="s">Stairs, decks, framing, guards, egress — plain language, section cited.</div>
            </button>
            <button className="list-item" onClick={() => go('reports')}>
              <div className="t">📊 Reports</div>
              <div className="s">Monthly / quarterly revenue, costs, profit, jobs by type, win rate, top customers.</div>
            </button>
            <button className="list-item" onClick={() => go('customers')}>
              <div className="t">👥 Customers</div>
              <div className="s">Customer directory — all their jobs, repeat flag, lead source, win rate.</div>
            </button>
            <button className="list-item" onClick={() => go('business')}>
              <div className="t">🏢 Business plan &amp; setup</div>
              <div className="s">The full business plan, Startup-to-Finish checklist, budgets, milestones — and the plan PDF.</div>
            </button>
            <button className="list-item" onClick={() => go('settings')}>
              <div className="t">⚙️ Settings &amp; data</div>
              <div className="s">Business info, Gemini key, reminders, backup &amp; restore.</div>
            </button>
            <button className="list-item" onClick={() => go('ai')}>
              <div className="t">🤖 Ask Gemini</div>
              <div className="s">General carpentry help — no job attached.</div>
            </button>
          </div>
          <div className="card">
            <h2>About</h2>
            <p className="muted">Carpentry Jobs v1.1.0 — AtotheI. Your jobs live only on this phone. Export a backup from Settings regularly. Contracts are draft templates, not legal advice. Code reference is reference only — the local inspector has the final say.</p>
          </div>
        </div>
      )}

      {toast.el}

      <nav className="bottomnav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={['home', 'jobs', 'calendar', 'ai'].includes(screen.name) && screen.name === n.id ? 'on' : screen.name === 'more' && n.id === 'more' ? 'on' : ''}
            onClick={() => {
              if (n.id === 'ai') go('ai')
              else go(n.id)
            }}
          >
            <span className="ico">{n.ico}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
