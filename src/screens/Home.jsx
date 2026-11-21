import React from 'react'
import { money, fmtDate, fmtDateTime, todayISO, jobActuals, STATUS_LABELS, overdueInvoices, warrantyExpiringSoon, maintenanceDue, complianceExpiringSoon } from '../lib/store.js'
import { StatusPill } from '../components/ui.jsx'

export default function Home({ store, goJob, goNew, goCalendar, goAi, goReports, goCustomers, goBusiness }) {
  const jobs = store.jobs || []
  const today = todayISO()
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndISO = weekEnd.toISOString().slice(0, 10)

  const bidsOut = jobs.filter((j) => j.status === 'bid')
  const enquiries = jobs.filter((j) => j.status === 'enquiry')
  const scheduledWeek = jobs.filter((j) => j.scheduledDate && j.scheduledDate >= today && j.scheduledDate <= weekEndISO && j.status !== 'done' && j.status !== 'cancelled' && j.status !== 'lost')
  const overdueFups = jobs.flatMap((j) => (j.followUps || []).filter((f) => !f.done && f.dueDate && f.dueDate < today).map((f) => ({ job: j, f })))
  const openFixes = jobs.flatMap((j) => (j.fixes || []).filter((x) => x.status === 'open').map((x) => ({ job: j, x })))
  const doneJobs = jobs.filter((j) => j.status === 'done' || j.outcome === 'completed')
  const overdueInv = overdueInvoices(store)
  const warrantySoon = warrantyExpiringSoon(store, 30)
  const maintDue = maintenanceDue(store)
  const complianceSoon = complianceExpiringSoon(store, 30)

  let revenue = 0, costs = 0
  for (const j of jobs) {
    const a = jobActuals(j)
    revenue += a.revenue
    costs += a.totalCosts
  }
  const profit = revenue - costs
  const bidsValue = bidsOut.reduce((s, j) => {
    const b = (j.bids || []).find((x) => x.id === j.acceptedBidId)
    return s + (b ? (b.materials || []).reduce((t, m) => t + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0) + (Number(b.labor) || 0) + (Number(b.other) || 0) : 0)
  }, 0)

  // Satisfaction: average stars + last 5 ratings (completion forms first).
  const allFb = jobs.flatMap((j) => (j.feedback || []).map((f) => ({ job: j, f })))
  const rated = allFb.filter((x) => Number(x.f.stars) > 0)
  const avgStars = rated.length ? (rated.reduce((s, x) => s + Number(x.f.stars), 0) / rated.length) : 0
  const recentRatings = [...rated].sort((a, b) => String(b.f.createdAt).localeCompare(String(a.f.createdAt))).slice(0, 5)

  return (
    <div className="page">
      <h1>Good morning, boss.</h1>
      <p className="muted">Jobs needing attention first. Everything else below.</p>

      <div className="card">
        <h2>Needs attention</h2>
        {bidsOut.length === 0 && enquiries.length === 0 && scheduledWeek.length === 0 && overdueFups.length === 0 && openFixes.length === 0 && overdueInv.length === 0 && warrantySoon.length === 0 && maintDue.length === 0 && complianceSoon.length === 0 && (
          <p className="muted">Nothing urgent. Nice.</p>
        )}
        {enquiries.length > 0 && (
          <p>📩 <b>{enquiries.length} enquir{enquiries.length > 1 ? 'ies' : 'y'} waiting for a quote</b> — {enquiries.slice(0, 3).map((j) => j.title || j.customerName).join(', ')} <button className="small" onClick={() => goJob(enquiries[0].id)}>Open</button></p>
        )}
        {complianceSoon.map(({ item, expiry, daysLeft }) => (
          <p key={item.id}>🏢 <b>Business paperwork expiring:</b> {item.label} — ends {fmtDate(expiry)} ({daysLeft} day{daysLeft === 1 ? '' : 's'} left) <button className="small" onClick={goBusiness}>Open</button></p>
        ))}
        {overdueInv.map(({ job, inv }) => (
          <p key={job.id}>💸 <b>Overdue invoice:</b> {job.title || job.customerName} — {money(jobActuals(job).balanceDue)} due{inv.dueDate ? ` ${fmtDate(inv.dueDate)}` : ''} <button className="small" onClick={() => goJob(job.id)}>Open</button></p>
        ))}
        {bidsOut.length > 0 && (
          <p>📝 <b>{bidsOut.length} bid{bidsOut.length > 1 ? 's' : ''} awaiting an answer</b> — {bidsOut.slice(0, 3).map((j) => j.title || j.customerName).join(', ')}</p>
        )}
        {scheduledWeek.length > 0 && (
          <p>📅 <b>{scheduledWeek.length} job{scheduledWeek.length > 1 ? 's' : ''} scheduled this week</b> — {scheduledWeek.slice(0, 3).map((j) => `${j.title || j.customerName} (${fmtDate(j.scheduledDate)})`).join(', ')}</p>
        )}
        {overdueFups.map(({ job, f }) => (
          <p key={f.id}>⏰ <b>Overdue follow-up:</b> {f.title} — {job.title || job.customerName} (due {fmtDate(f.dueDate)})</p>
        ))}
        {openFixes.map(({ job, x }) => (
          <p key={x.id}>🔧 <b>Open fix:</b> {x.title} — {job.title || job.customerName}{x.warranty ? ' (warranty)' : ''}</p>
        ))}
        {warrantySoon.map(({ job, expiry, daysLeft }) => (
          <p key={job.id}>🛡 <b>Warranty expiring:</b> {job.title || job.customerName} — ends {fmtDate(expiry)} ({daysLeft} day{daysLeft === 1 ? '' : 's'} left)</p>
        ))}
        {maintDue.map(({ job, due }) => (
          <p key={job.id}>🔁 <b>Maintenance due:</b> {job.title || job.customerName} — {job.maintenance?.notes || 'recurring maintenance'} (due {fmtDate(due)}) <button className="small" onClick={() => goJob(job.id)}>Open</button></p>
        ))}
      </div>

      <p className="muted">Last automatic backup: {store.lastBackupAt ? fmtDateTime(store.lastBackupAt) : 'never yet — open Settings to back up by hand.'} Backups keep the last 7 days in Documents.</p>

      <div className="grid2">
        <div className="stat"><div className="v">{bidsOut.length}</div><div className="k">Bids out ({money(bidsValue)})</div></div>
        <div className="stat"><div className="v">{doneJobs.length}</div><div className="k">Jobs done</div></div>
        <div className="stat"><div className="v money">{money(revenue)}</div><div className="k">Revenue (payments in)</div></div>
        <div className="stat"><div className="v money">{money(costs)}</div><div className="k">Costs (actual)</div></div>
        <div className="stat"><div className={`v money ${profit >= 0 ? 'pos' : 'neg'}`}>{money(profit)}</div><div className="k">Profit / loss</div></div>
        <div className="stat">
          <div className="v">{rated.length ? avgStars.toFixed(1) + ' ★' : '—'}</div>
          <div className="k">Customer satisfaction ({rated.length} ratings)</div>
        </div>
      </div>

      {recentRatings.length > 0 && (
        <div className="card">
          <h2>Satisfaction trend — latest first</h2>
          {recentRatings.map(({ job, f }) => (
            <p key={f.id}>{'★'.repeat(Number(f.stars))}{'☆'.repeat(5 - Number(f.stars))} — {job.title || job.customerName} <span className="muted">({f.kind === 'mid-job' ? 'mid-job' : 'completion'}, {fmtDate(f.createdAt)})</span></p>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Next up</h2>
        {jobs.filter((j) => !['done', 'cancelled', 'lost'].includes(j.status)).slice(0, 5).map((j) => (
          <button key={j.id} className="list-item" onClick={() => goJob(j.id)}>
            <div className="row between"><span className="t">{j.title || 'Untitled job'}</span><StatusPill status={j.status} /></div>
            <div className="s">{j.customerName} {j.scheduledDate ? '• ' + fmtDate(j.scheduledDate) : ''}</div>
          </button>
        ))}
        {jobs.filter((j) => !['done', 'cancelled', 'lost'].includes(j.status)).length === 0 && (
          <p className="muted">No active jobs. Time to bid something.</p>
        )}
      </div>

      <div className="row grow">
        <button className="primary" onClick={goNew}>+ New job</button>
        <button onClick={goCalendar}>Calendar</button>
        <button onClick={goAi}>Ask Gemini</button>
      </div>
      <div className="row grow" style={{ marginTop: 8 }}>
        <button onClick={goReports}>📊 Reports</button>
        <button onClick={goCustomers}>👥 Customers</button>
      </div>
    </div>
  )
}
