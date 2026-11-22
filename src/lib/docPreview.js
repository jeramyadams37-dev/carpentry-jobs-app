// In-app document previews — what-you-see-is-what-the-PDF-says.
// Each builder mirrors its matching function in pdf.js section for section,
// using the SAME store helpers (money, bidTotal, bidTax, jobTimeTotals…),
// so the preview shows exactly the numbers and lines the PDF will contain.
// The preview is read-only: editing happens on the tabs, never here.
// Shape: { title, stamp?, brand, bizLine, kv: [[k, v]…], sections: [
//   { heading, text?, lines?: [string], kv?: [[k, v]…],
//     table?: { head: [string], rows: [[string]] },
//     totals?: [[label, amountString]], grand?: [label, amountString] }… ],
//   sig?: [string] }
import {
  money, fmtDate, fmtDateTime, fmtHours, bidTotal, bidMaterialsTotal, bidOverhead,
  effectiveLabor, acceptedBid, jobActuals, defaultPaymentPlan, paymentPlanAmounts,
  salesTaxRate, bidTax, bidTaxableMaterials, FINISH_GRADES, FINISHING_BY,
  jobTimeTotals, hoursComparison, jobLaborRate, timeEntryHours,
} from './store.js'
import { HRRA_THRESHOLD, HRRA_PAMPHLET_NAME, HRRA_PAMPHLET_SUMMARY, hrraAmount } from './hrra.js'

const BRAND = 'AtotheI Carpentry'

function licenseText(settings) {
  return (settings.municipalLicenses || []).filter((l) => l.city || l.number).map((l) => `${l.city || '—'}: #${l.number || '—'}`).join('; ')
}

function bizLine(settings) {
  return [settings.businessPhone, settings.businessEmail].filter(Boolean).join('  •  ')
}

function base(job, settings) {
  return {
    brand: BRAND,
    bizLine: bizLine(settings),
    kv: [
      ['Customer:', job.customerName || '—'],
      ['Phone:', job.phone || '—'],
      ['Address:', job.address || '—'],
      ['Job:', job.title || '—'],
      ['Date:', fmtDate(new Date().toISOString().slice(0, 10))],
    ],
  }
}

export function quotePreviewData(job, bid, settings) {
  const d = base(job, settings)
  d.title = 'Bid / Quote'
  d.kv.push(['Valid until:', bid.validUntil ? fmtDate(bid.validUntil) : '—'])
  const lic = licenseText(settings)
  if (lic) d.kv.push(['License(s):', lic])
  const finishGrade = FINISH_GRADES.find((g) => g.id === bid.finishGrade)?.label || 'Not specified'
  const finishingBy = FINISHING_BY.find((g) => g.id === bid.finishingBy)?.label || 'Not specified'
  const validText = bid.validUntil ? `This quote is valid until ${fmtDate(bid.validUntil)}.` : 'This quote is valid for 30 days from the date above.'
  const totals = [
    ['Materials', money(bidMaterialsTotal(bid))],
    ['Labor', money(effectiveLabor(bid))],
    ['Other', money(Number(bid.other) || 0)],
  ]
  if (Number(bid.overheadPct) > 0) totals.push([`Overhead (${Number(bid.overheadPct)}%)`, money(bidOverhead(bid))])
  totals.push(['TOTAL', money(bidTotal(bid))])
  totals.push([`Sales tax (${salesTaxRate(settings).toFixed(2)}% on taxable materials ${money(bidTaxableMaterials(bid))})`, money(bidTax(bid, settings))])
  d.sections = [
    { heading: 'Scope', text: bid.scope || job.description || '—' },
    {
      heading: 'Finish',
      kv: [['Finish:', `${finishGrade} — finishing by ${finishingBy}`]],
    },
    {
      heading: 'Line items',
      table: {
        head: ['Item', 'Qty', 'Unit', 'Amount'],
        rows: (bid.materials || []).map((m) => [
          `${m.name} (x${m.qty})`, String(m.qty), money(m.unitCost), money((Number(m.qty) || 0) * (Number(m.unitCost) || 0)),
        ]),
      },
      totals,
      grand: ['TOTAL WITH TAX', money(bidTotal(bid) + bidTax(bid, settings))],
    },
    {
      heading: 'Notes',
      text: `${validText} Material prices can move between quote and build — if lumber or sheet-goods prices rise before work starts, the price will be re-quoted and agreed in writing before work starts. Price covers the scope listed; changes to scope are handled by a written change order.`,
    },
  ]
  d.sig = ['Customer signature: ________________________________     Date: __________']
  return d
}

export function contractPreviewData(job, settings) {
  const bid = acceptedBid(job)
  const fin = jobActuals(job)
  const total = fin.quote || (bid ? bidTotal(bid) : 0)
  const plan = (job.paymentPlan && job.paymentPlan.length ? job.paymentPlan : defaultPaymentPlan())
    .map((m) => ({ ...m, amount: Math.round(total * ((Number(m.pct) || 0) / 100) * 100) / 100 }))
  const d = base(job, settings)
  d.title = 'Carpentry Contract'
  d.stamp = 'DRAFT TEMPLATE - NOT LEGAL ADVICE'
  d.sections = []
  d.sections.push({
    heading: '',
    text: 'DRAFT TEMPLATE - NOT LEGAL ADVICE. Have a local attorney review this contract before use. This template does not replace legal advice.',
  })
  const contractorKv = [
    ['Contractor:', settings.businessName || BRAND],
    ['Business address:', settings.businessAddress || '— (add a physical business address in Settings — HRRA requires it, and it must not be a P.O. Box)'],
  ]
  const lic = licenseText(settings)
  if (lic) contractorKv.push(['License(s):', lic])
  contractorKv.push(['Customer:', job.customerName || '—'])
  contractorKv.push(['Job address:', job.address || '—'])
  contractorKv.push(['Date:', fmtDate(new Date().toISOString().slice(0, 10))])
  // Same header block as the contract PDF: contractor first.
  d.kv = contractorKv
  const finish = bid && (bid.finishGrade || bid.finishingBy)
    ? `${FINISH_GRADES.find((g) => g.id === bid.finishGrade)?.label || 'Not specified'} — finishing by ${FINISHING_BY.find((g) => g.id === bid.finishingBy)?.label || 'Not specified'}`
    : ''
  d.sections.push({ heading: '1. Scope of work', text: (bid && bid.scope) || job.description || '—', kv: finish ? [['Finish:', finish]] : [] })
  const priceTotals = [['Contract price', money(total)]]
  if (bid) priceTotals.push([`Sales tax (${salesTaxRate(settings).toFixed(2)}% on taxable materials — collected with payments)`, money(bidTax(bid, settings))])
  d.sections.push({ heading: '2. Price', totals: priceTotals })
  d.sections.push({
    heading: '3. Payment schedule',
    kv: plan.map((m) => [`${m.label} (${Number(m.pct) || 0}%):`, money(m.amount)]),
  })
  const hrra = job.hrra || {}
  d.sections.push({
    heading: '4. Timeline',
    kv: [
      ['Scheduled start:', fmtDate(job.scheduledDate)],
      ['Estimated completion:', fmtDate(hrra.estimatedCompletionDate || job.finishedDate)],
    ],
  })
  const cos = job.contract?.changeOrders || []
  d.sections.push({
    heading: '5. Change orders',
    text: 'Any change to the scope or price must be written up as a change order, priced, and signed by both parties before the work starts. Verbal changes do not change this contract.',
    lines: cos.map((c) => `• ${c.title} — ${money(c.price)}${c.signedAt ? ' (signed ' + fmtDate(c.signedAt) + ')' : ' (unsigned)'}`),
  })
  d.sections.push({
    heading: '6. Warranty',
    text: 'Workmanship is warranted for 12 months from completion against defects in labor. Materials are covered by the manufacturer warranty where one applies. This warranty does not cover normal wear, misuse, or changes made by others.',
  })
  d.sections.push({
    heading: '7. Material prices',
    text: 'Lumber and sheet-goods prices move between quote and build. If material prices rise before work starts, the contractor will re-quote the affected items and the new price must be agreed in writing before work starts. A fixed price with no material clause absorbs the difference — this clause exists so it does not.',
  })
  const arb = hrra.arbitration || {}
  const jury = hrra.juryWaiver || {}
  d.sections.push({
    heading: '8. Binding arbitration & jury trial waiver',
    lines: [
      arb.choice
        ? `Binding arbitration: ${arb.choice === 'accept' ? 'ACCEPTED' : 'REJECTED'} — initials ${arb.initials || '—'}, date ${fmtDate(arb.date)}.`
        : 'Binding arbitration: [ ] ACCEPTED  initials ______  date __________     [ ] REJECTED  initials ______  date __________',
      jury.choice
        ? `Jury trial waiver: ${jury.choice === 'accept' ? 'ACCEPTED' : 'REJECTED'} — initials ${jury.initials || '—'}, date ${fmtDate(jury.date)}.`
        : 'Jury trial waiver: [ ] ACCEPTED  initials ______  date __________     [ ] REJECTED  initials ______  date __________',
    ],
  })
  const hrraAmountValue = hrraAmount(job, bidTotal)
  const hrraNote = hrraAmountValue > HRRA_THRESHOLD
    ? `This is a residential job over $1,000 (${money(hrraAmountValue)}), so the Illinois Home Repair and Remodeling Act applies. The contractor gave the homeowner the Illinois Attorney General's pamphlet "${HRRA_PAMPHLET_NAME}" before work began.`
    : `This job is $1,000 or under (${money(hrraAmountValue)}), so the HRRA pamphlet acknowledgment is not required for it.`
  const ack = hrra.pamphletAck || {}
  d.sections.push({
    heading: '9. Home Repair: Know Your Consumer Rights (Illinois HRRA)',
    text: hrraNote,
    lines: [
      ...HRRA_PAMPHLET_SUMMARY.map((s) => `• ${s}`),
      ack.signedAt
        ? `Pamphlet acknowledgment: received and signed by ${ack.signedBy} on ${fmtDate(ack.signedAt)}.`
        : 'Pamphlet acknowledgment:  Received by ________________________________     Date: __________',
    ],
  })
  d.sig = [
    'Customer: ________________________________     Date: __________',
    'Contractor: ________________________________     Date: __________',
  ]
  return d
}

export function timesheetPreviewData(job, settings) {
  const bid = acceptedBid(job)
  const totals = jobTimeTotals(job, settings.defaultLaborRate)
  const hc = hoursComparison(job, settings.defaultLaborRate)
  const rate = jobLaborRate(job, settings.defaultLaborRate)
  const d = {
    title: 'Timesheet — hours on this job',
    brand: BRAND,
    bizLine: bizLine(settings),
    kv: [
      ['Job:', job.title || '—'],
      ['Customer:', job.customerName || '—'],
      ['Job rate:', `${money(rate)}/hr`],
      ['Date:', fmtDate(new Date().toISOString().slice(0, 10))],
    ],
    sections: [],
    sig: [],
  }
  const quoted = []
  if (!bid) {
    quoted.push('No accepted bid yet — quoted hours come from the accepted bid\'s labor hours.')
  } else if (!hc.quoted) {
    quoted.push('The accepted bid has no labor hours entered — put hours in the estimate builder and this comparison comes alive.')
  } else {
    quoted.push(`Quoted: ${fmtHours(hc.quoted)} • Actual clocked: ${fmtHours(hc.actual)} • Gap: ${hc.diff > 0 ? '+' : ''}${fmtHours(hc.diff)}`)
    quoted.push(hc.diff > 0 ? `This job ran ${fmtHours(hc.diff)} over the quote.` : hc.diff < 0 ? `This job came in ${fmtHours(-hc.diff)} under the quoted hours.` : 'Right on the quote.')
  }
  d.sections.push({ heading: 'Quoted hours vs actual hours', lines: quoted })
  const entries = (job.timeEntries || []).slice()
  const rows = entries.map((e) => {
    const h = timeEntryHours(e)
    return [
      e.worker || 'Me',
      fmtDateTime(e.clockIn),
      e.clockOut ? fmtDateTime(e.clockOut) : 'still in',
      e.clockOut ? fmtHours(h) : '—',
      e.clockOut ? money(h * (Number(e.rate) || 0)) : '—',
    ]
  })
  if (rows.length === 0) rows.push(['No time entries yet', '', '', '', ''])
  d.sections.push({
    heading: 'Clock in / out entries',
    table: { head: ['Who', 'Clock in', 'Clock out', 'Hours', 'Amount'], rows },
    totals: [
      ['Total hours', fmtHours(totals.hours)],
      ['Labor cost from time', money(totals.labor)],
      ...Object.keys(totals.byWorker).map((w) => [`${w}`, fmtHours(totals.byWorker[w])]),
    ],
  })
  const helpers = job.helperHours || []
  const helperHrs = helpers.reduce((s, h) => s + (Number(h.hours) || 0), 0)
  const helperPay = helpers.reduce((s, h) => s + (Number(h.hours) || 0) * (Number(h.rate) || 0), 0)
  const hRows = helpers.map((h) => [h.name || 'Helper', fmtDate(h.date), fmtHours(h.hours), money(h.rate), money((Number(h.hours) || 0) * (Number(h.rate) || 0))])
  if (hRows.length === 0) hRows.push(['No helper hours logged', '', '', '', ''])
  d.sections.push({
    heading: 'Helper hours',
    table: { head: ['Helper', 'Date', 'Hours', 'Rate', 'Pay'], rows: hRows },
    totals: [
      ['Total helper hours', fmtHours(helperHrs)],
      ['Helper pay', money(helperPay)],
    ],
  })
  return d
}

// Plain-text version of a preview, for the share sheet (timesheets have no
// PDF, so the preview shares as text instead).
export function previewToText(doc) {
  const lines = []
  if (doc.stamp) lines.push(doc.stamp)
  lines.push(doc.brand)
  if (doc.bizLine) lines.push(doc.bizLine)
  lines.push(doc.title)
  lines.push('')
  for (const [k, v] of doc.kv || []) lines.push(`${k} ${v}`)
  for (const s of doc.sections || []) {
    lines.push('')
    if (s.heading) lines.push(s.heading)
    if (s.text) lines.push(s.text)
    for (const [k, v] of s.kv || []) lines.push(`${k} ${v}`)
    for (const l of s.lines || []) lines.push(l)
    if (s.table) {
      lines.push(s.table.head.join(' | '))
      for (const r of s.table.rows) lines.push(r.join(' | '))
    }
    for (const [k, v] of s.totals || []) lines.push(`${k}: ${v}`)
    if (s.grand) lines.push(`${s.grand[0]}: ${s.grand[1]}`)
  }
  for (const s of doc.sig || []) lines.push('', s)
  return lines.join('\n')
}
