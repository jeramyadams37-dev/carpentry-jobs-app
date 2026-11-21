// Reports — monthly / quarterly business numbers, cash basis
// (revenue from payment dates, costs from expense dates + clocked time).
import React, { useState } from 'react'
import { money, computeReports, monthPeriod, quarterPeriod, JOB_TYPES, overallWinRate, fmtHours, quickbooksCSV, salesTaxRate } from '../lib/store.js'
import { saveToDownloads } from '../lib/files.js'

function csvBase64(csv) {
  return btoa(unescape(encodeURIComponent(csv)))
}

export default function Reports({ store, toast }) {
  const [kind, setKind] = useState('month')
  const [offset, setOffset] = useState(0)
  const period = kind === 'month' ? monthPeriod(offset) : quarterPeriod(offset)
  const r = computeReports(store, period)
  const win = overallWinRate(store)

  return (
    <div className="page">
      <h1>Reports</h1>
      <p className="muted">Cash basis: revenue counts when a payment lands, costs count when the money goes out (expenses + clocked hours).</p>

      <div className="row">
        <button className={`chip ${kind === 'month' ? 'on' : ''}`} onClick={() => { setKind('month'); setOffset(0) }}>Monthly</button>
        <button className={`chip ${kind === 'quarter' ? 'on' : ''}`} onClick={() => { setKind('quarter'); setOffset(0) }}>Quarterly</button>
      </div>
      <div className="row between" style={{ marginTop: 10 }}>
        <button className="small" onClick={() => setOffset(offset - 1)}>← Prev</button>
        <b>{period.label}</b>
        <button className="small" onClick={() => setOffset(offset + 1)} disabled={offset >= 0}>Next →</button>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="v money">{money(r.revenue)}</div><div className="k">Revenue</div></div>
        <div className="stat"><div className="v money">{money(r.costs)}</div><div className="k">Costs</div></div>
        <div className={`stat`}><div className={`v money ${r.profit >= 0 ? 'pos' : 'neg'}`}>{money(r.profit)}</div><div className="k">Profit / loss</div></div>
        <div className="stat"><div className="v">{r.jobsFinished}</div><div className="k">Jobs finished</div></div>
        <div className="stat"><div className="v money">{money(r.avgJobValue)}</div><div className="k">Average job value</div></div>
        <div className="stat"><div className="v">{win.rate === null ? '—' : win.rate + '%'}</div><div className="k">Win rate ({win.won} won / {win.lost} lost, all time)</div></div>
      </div>

      <div className="card">
        <h2>Jobs finished by type</h2>
        {Object.keys(r.byType).length === 0 && <p className="muted">No jobs finished in this period.</p>}
        {Object.keys(r.byType).map((t) => (
          <p key={t}>{JOB_TYPES.find((x) => x.id === t)?.label || t}: <b>{r.byType[t]}</b></p>
        ))}
      </div>

      <div className="card">
        <h2>By customer type</h2>
        <p className="muted">Builder work pays less per hour than direct — this is where you see it. Finished jobs and revenue are this period; win rate is all-time per type.</p>
        {r.byCustomerType.filter((t) => t.finished > 0 || t.won + t.lost > 0).length === 0 && <p className="muted">No jobs with a customer type yet — set the type on the job (New job form or Edit).</p>}
        {r.byCustomerType.filter((t) => t.finished > 0 || t.won + t.lost > 0).map((t) => (
          <p key={t.type || 'none'}>{t.label}: <b>{t.finished}</b> finished • <b className="money">{money(t.revenue)}</b> • win rate {t.winRate === null ? '—' : t.winRate + '%'} ({t.won} won / {t.lost} lost)</p>
        ))}
      </div>

      <div className="card">
        <h2>Hours — quoted vs actual (jobs finished this period)</h2>
        <p>Quoted: <b>{fmtHours(r.hoursSummary.quoted)}</b> • Actual clocked: <b>{fmtHours(r.hoursSummary.actual)}</b> • Gap: <b className={r.hoursSummary.diff > 0 ? 'neg' : 'pos'}>{r.hoursSummary.diff > 0 ? '+' : ''}{fmtHours(r.hoursSummary.diff)}</b></p>
        <p className="muted">Quoted vs actual is how the next quote gets better. If actual keeps running over quoted, raise the hours (or the rate) on the next estimate.</p>
      </div>

      <div className="card">
        <h2>Illinois sales tax (jobs finished this period)</h2>
        <p>Tax due on accepted bids: <b className="money">{money(r.taxSummary.due)}</b> • Tax collected (pro-rata from payments received): <b className="money">{money(r.taxSummary.collected)}</b></p>
        <p className="muted">Rate: {salesTaxRate(store.settings).toFixed(2)}% (Illinois 6.25% state base + your local rate from Settings). Materials are taxable; installation labor is not. Tax due is what the accepted bids charge; tax collected is the tax share of payments actually received so far. This is a bookkeeping summary, not a tax filing — confirm with an accountant.</p>
      </div>

      <div className="card">
        <h2>QuickBooks export</h2>
        <p className="muted">CSV of invoices, expenses, and payments for this period, formatted for QuickBooks Online import (Settings → Import data, then map the columns). One-way export only — two-way sync needs a backend + OAuth, which this local-first app does not have.</p>
        <div className="row wrap">
          <button className="small primary" onClick={async () => { try { const csv = quickbooksCSV(store, period); const where = await saveToDownloads(`quickbooks_${period.start}_${period.end}.csv`, csvBase64(csv), 'text/csv'); if (toast) toast(`quickbooks_${period.start}_${period.end}.csv — ${where}`) } catch (e) { if (toast) toast(e.message || 'Export failed.') } }}>Export this period (CSV)</button>
          <button className="small" onClick={async () => { try { const csv = quickbooksCSV(store, null); const where = await saveToDownloads('quickbooks_all.csv', csvBase64(csv), 'text/csv'); if (toast) toast(`quickbooks_all.csv — ${where}`) } catch (e) { if (toast) toast(e.message || 'Export failed.') } }}>Export everything (CSV)</button>
        </div>
      </div>

      <div className="card">
        <h2>Top customers (this period)</h2>
        {r.topCustomers.length === 0 && <p className="muted">No finished jobs in this period.</p>}
        {r.topCustomers.map((c, i) => (
          <p key={i}>{i + 1}. {c.name} — <b className="money">{money(c.revenue)}</b> ({c.jobs} job{c.jobs > 1 ? 's' : ''})</p>
        ))}
      </div>
    </div>
  )
}
