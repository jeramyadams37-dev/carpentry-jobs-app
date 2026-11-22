// Client-side PDFs with jsPDF — same pattern as AutoHustle shop tickets:
// generated on the phone, saved to Downloads, opened in the PDF viewer.
// Filenames: <job-slug>_<type>_<YYYY-MM-DD>_<HHMM>.pdf
import { jsPDF } from 'jspdf'
import { money, fmtDate, todayISO, bidTotal, bidMaterialsTotal, bidOverhead, effectiveLabor, acceptedBid, jobActuals, slugify, fileStamp, FINISH_GRADES, FINISHING_BY, defaultPaymentPlan, paymentPlanAmounts, paymentPlanAmountsFor, businessProgress, progressSummary, salesTaxRate, bidTax, bidTaxableMaterials } from './store.js'
import { PLAN_SECTIONS } from './planContent.js'
import { HRRA_THRESHOLD, HRRA_PAMPHLET_NAME, HRRA_PAMPHLET_SUMMARY, hrraAmount } from './hrra.js'

// Municipal license numbers, per city — printed on quotes, invoices, and
// contracts when they are set in Settings / Business.
function licenseText(settings) {
  return (settings.municipalLicenses || []).filter((l) => l.city || l.number).map((l) => `${l.city || '—'}: #${l.number || '—'}`).join('; ')
}

function licenseKv(doc, y, settings) {
  const t = licenseText(settings)
  return t ? kv(doc, y, 'License(s):', t) : y
}

const BRAND = 'AtotheI Carpentry'
const MARGIN = 16
const PAGE_W = 210

function header(doc, title, settings, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(BRAND, MARGIN, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const biz = [settings.businessPhone, settings.businessEmail].filter(Boolean).join('  •  ')
  if (biz) doc.text(biz, MARGIN, y + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, MARGIN, y + 17)
  doc.setDrawColor(180)
  doc.line(MARGIN, y + 21, PAGE_W - MARGIN, y + 21)
  return y + 28
}

function footer(doc, label) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(110)
    doc.text(`${label}  •  Page ${i} of ${pages}`, MARGIN, 287)
    doc.setTextColor(0)
  }
}

function section(doc, y, title) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, MARGIN, y)
  return y + 7
}

function kv(doc, y, k, v) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(k, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(String(v ?? '—'), PAGE_W - MARGIN * 2 - 42)
  doc.text(lines, MARGIN + 42, y)
  return y + lines.length * 6 + 2
}

function table(doc, y, head, rows) {
  const colW = [86, 26, 30, 36]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  let x = MARGIN
  head.forEach((h, i) => { doc.text(h, x, y); x += colW[i] })
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2)
  y += 8
  doc.setFont('helvetica', 'normal')
  for (const r of rows) {
    if (y > 268) { doc.addPage(); y = 20 }
    x = MARGIN
    const labelLines = doc.splitTextToSize(String(r[0]), colW[0] - 2)
    doc.text(labelLines, x, y)
    doc.text(String(r[1]), x + colW[0], y)
    doc.text(String(r[2]), x + colW[0] + colW[1], y)
    doc.text(String(r[3]), x + colW[0] + colW[1] + colW[2], y)
    y += Math.max(6, labelLines.length * 5)
  }
  return y + 4
}

function totalLine(doc, y, label, amount) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(label, MARGIN, y)
  doc.text(money(amount), PAGE_W - MARGIN - 36, y)
  return y + 8
}

function draftStamp(doc) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(185, 28, 28)
  doc.text('DRAFT TEMPLATE - NOT LEGAL ADVICE', MARGIN, 12)
  doc.setTextColor(0)
}

function ensure(doc, y, need) {
  if (y + need > 268) { doc.addPage(); draftStamp(doc); return 24 }
  return y
}

function pdfBase64(doc) {
  const uri = doc.output('datauristring')
  return uri.split(',')[1]
}

function jobFileName(job, kind) {
  return `${slugify(job.title || job.customerName || 'job')}_${kind}_${fileStamp()}.pdf`
}

export function quotePDF(job, bid, settings) {
  const doc = new jsPDF()
  let y = header(doc, 'Bid / Quote', settings, 16)
  y = kv(doc, y, 'Customer:', job.customerName || '—')
  y = kv(doc, y, 'Phone:', job.phone || '—')
  y = kv(doc, y, 'Address:', job.address || '—')
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Date:', fmtDate(todayISO()))
  y = kv(doc, y, 'Valid until:', bid.validUntil ? fmtDate(bid.validUntil) : '—')
  y = licenseKv(doc, y, settings)
  y += 4
  y = section(doc, y, 'Scope')
  const scopeLines = doc.splitTextToSize(bid.scope || job.description || '—', PAGE_W - MARGIN * 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(scopeLines, MARGIN, y)
  y += scopeLines.length * 6 + 2
  // Finish line: only when a finish detail is actually set — never print
  // a "Not specified" placeholder on a customer-facing quote.
  const finishParts = []
  if (bid.finishGrade) {
    const fg = FINISH_GRADES.find((g) => g.id === bid.finishGrade)?.label
    if (fg) finishParts.push(fg)
  }
  if (bid.finishingBy) {
    const fb = FINISHING_BY.find((g) => g.id === bid.finishingBy)?.label
    if (fb) finishParts.push(`finishing by ${fb}`)
  }
  if (finishParts.length) y = kv(doc, y, 'Finish:', finishParts.join(' — '))
  y += 4
  y = section(doc, y, 'Line items')
  const rows = (bid.materials || []).map((m) => [
    `${m.name} (x${m.qty})`, String(m.qty), money(m.unitCost), money((Number(m.qty) || 0) * (Number(m.unitCost) || 0)),
  ])
  y = table(doc, y, ['Item', 'Qty', 'Unit', 'Amount'], rows)
  y = totalLine(doc, y, 'Materials', bidMaterialsTotal(bid))
  y = totalLine(doc, y, 'Labor', effectiveLabor(bid))
  y = totalLine(doc, y, 'Other', Number(bid.other) || 0)
  if (Number(bid.overheadPct) > 0) y = totalLine(doc, y, `Overhead (${Number(bid.overheadPct)}%)`, bidOverhead(bid))
  y = totalLine(doc, y, 'TOTAL', bidTotal(bid))
  // Illinois sales tax: materials are taxable, installation labor is not.
  // Rate = 6.25% state base + the local rate from Settings.
  y = totalLine(doc, y, `Sales tax (${salesTaxRate(settings).toFixed(2)}% on taxable materials ${money(bidTaxableMaterials(bid))})`, bidTax(bid, settings))
  y = totalLine(doc, y, 'TOTAL WITH TAX', bidTotal(bid) + bidTax(bid, settings))
  y += 4
  // Payment schedule: the job's configured milestones, or the default
  // 50/40/10 split when none is configured yet (a quote is written before
  // the bid is accepted, so the plan may not exist). Amounts are computed
  // from this bid's total with the same base and rounding as the invoice,
  // so the quote and the invoice agree. Progress-billed jobs have no
  // milestone schedule — the section is omitted, never printed empty.
  if (job.billingType !== 'progress') {
    const plan = paymentPlanAmountsFor(bidTotal(bid), (job.paymentPlan && job.paymentPlan.length ? job.paymentPlan : defaultPaymentPlan()))
    if (plan.length > 0) {
      y = ensure(doc, y, 30)
      y = section(doc, y, 'Payment schedule')
      for (const m of plan) {
        y = ensure(doc, y, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text(`• ${m.label} (${Number(m.pct) || 0}%) — ${money(m.amount)}`, MARGIN, y)
        y += 7
      }
      y += 4
    }
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const validText = bid.validUntil ? `This quote is valid until ${fmtDate(bid.validUntil)}.` : 'This quote is valid for 30 days from the date above.'
  const note = `${validText} Material prices can move between quote and build — if lumber or sheet-goods prices rise before work starts, the price will be re-quoted and agreed in writing before work starts. Price covers the scope listed; changes to scope are handled by a written change order.`
  const noteLines = doc.splitTextToSize(note, PAGE_W - MARGIN * 2)
  doc.text(noteLines, MARGIN, y)
  y += noteLines.length * 6 + 14
  y = ensure(doc, y, 20)
  doc.text('Customer signature: ________________________________     Date: __________', MARGIN, y)
  footer(doc, `Quote — ${job.title || ''}`)
  return { filename: jobFileName(job, 'quote'), base64: pdfBase64(doc), mime: 'application/pdf' }
}

export function invoicePDF(job, settings) {
  const doc = new jsPDF()
  const bid = acceptedBid(job)
  const fin = jobActuals(job)
  let y = header(doc, 'Invoice', settings, 16)
  y = kv(doc, y, 'Customer:', job.customerName || '—')
  y = kv(doc, y, 'Phone:', job.phone || '—')
  y = kv(doc, y, 'Address:', job.address || '—')
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Date:', fmtDate(todayISO()))
  y = licenseKv(doc, y, settings)
  y += 4
  y = section(doc, y, 'Work billed')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const descLines = doc.splitTextToSize((bid && bid.scope) || job.description || '—', PAGE_W - MARGIN * 2)
  doc.text(descLines, MARGIN, y)
  y += descLines.length * 6 + 6
  y = totalLine(doc, y, 'Job total (accepted bid)', fin.quote)
  // Illinois sales tax, split by category: taxable materials vs
  // non-taxable installation labor. Balance due includes the tax.
  const invTax = bid ? bidTax(bid, settings) : 0
  const invTaxRate = salesTaxRate(settings)
  y = totalLine(doc, y, `Sales tax (${invTaxRate.toFixed(2)}% on taxable materials)`, invTax)
  y = totalLine(doc, y, 'Invoice total (with tax)', fin.quote + invTax)
  y += 4
  y = section(doc, y, 'Payments received')
  const rows = (job.payments || []).map((p) => [p.label || p.kind || 'Payment', fmtDate(p.date), '', money(p.amount)])
  if (rows.length === 0) rows.push(['No payments recorded yet', '', '', money(0)])
  y = table(doc, y, ['Payment', 'Date', '', 'Amount'], rows)
  y = totalLine(doc, y, 'Paid so far', fin.revenue)
  y = totalLine(doc, y, 'BALANCE DUE (incl. tax)', fin.quote + invTax - fin.revenue)
  y += 4
  const plan = job.paymentPlan && job.paymentPlan.length ? paymentPlanAmounts(job) : []
  if (plan.length > 0 && job.billingType !== 'progress') {
    y = ensure(doc, y, 30)
    y = section(doc, y, 'Payment schedule')
    for (const m of plan) {
      y = ensure(doc, y, 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(`• ${m.label} (${Number(m.pct) || 0}%) — ${money(m.amount)}${m.paid ? '  ✓ paid' : ''}`, MARGIN, y)
      y += 7
    }
    y += 4
  }
  if (job.billingType === 'progress') {
    const ps = progressSummary(job, settings)
    y = ensure(doc, y, 40)
    y = section(doc, y, 'Progress billing summary')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const psRows = [
      ['Scheduled value (total)', money(ps.total)],
      ['Earned to date', money(ps.earned)],
      [`Less retainage (${ps.pct}%)`, money(ps.retainageHeldToDate)],
      ['Total earned less retainage', money(ps.lessRetainage)],
      ['Less previous applications', money(ps.previous)],
      ['Current payment due', money(ps.currentDue)],
      ['Balance to finish', money(ps.balance)],
      ['Retainage held', money(ps.retainageHeld)],
    ]
    for (const [k, v] of psRows) { y = ensure(doc, y, 8); y = kv(doc, y, k + ':', v) }
    y += 2
    doc.setFontSize(10)
    const psNote = 'Progress invoice — see the pay application (G702/G703-style template) for the full schedule of values. Retainage is released at completion, with the final walkthrough.'
    const psNoteLines = doc.splitTextToSize(psNote, PAGE_W - MARGIN * 2)
    doc.text(psNoteLines, MARGIN, y)
    y += psNoteLines.length * 6 + 4
  }
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Thank you for your business. Please pay the balance due on completion.', MARGIN, y)
  footer(doc, `Invoice — ${job.title || ''}`)
  return { filename: jobFileName(job, 'invoice'), base64: pdfBase64(doc), mime: 'application/pdf' }
}

export function workOrderPDF(job, settings) {
  const doc = new jsPDF()
  const bid = acceptedBid(job)
  let y = header(doc, 'Job Summary / Work Order', settings, 16)
  y = kv(doc, y, 'Customer:', job.customerName || '—')
  y = kv(doc, y, 'Phone:', job.phone || '—')
  y = kv(doc, y, 'Address:', job.address || '—')
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Status:', job.status)
  y = kv(doc, y, 'Scheduled:', fmtDate(job.scheduledDate))
  y += 4
  y = section(doc, y, 'Scope')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const descLines = doc.splitTextToSize((bid && bid.scope) || job.description || '—', PAGE_W - MARGIN * 2)
  doc.text(descLines, MARGIN, y)
  y += descLines.length * 6 + 6
  y = section(doc, y, 'Materials')
  const mrows = bid ? bid.materials.map((m) => [`${m.name} (x${m.qty})`, String(m.qty), money(m.unitCost), money((Number(m.qty) || 0) * (Number(m.unitCost) || 0))]) : []
  if (mrows.length === 0) mrows.push(['No materials listed', '', '', ''])
  y = table(doc, y, ['Item', 'Qty', 'Unit', 'Amount'], mrows)
  y = section(doc, y, 'Tools')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const tools = job.tools || []
  if (tools.length === 0) { doc.text('No tools listed.', MARGIN, y); y += 7 }
  for (const t of tools) {
    y = ensure(doc, y, 7)
    doc.text(`• ${t.name} — ${t.owned ? 'owned' : 'rented ' + money(t.rentalCost)}`, MARGIN, y)
    y += 6
  }
  y += 2
  y = section(doc, y, 'Notes')
  const notes = job.notes || []
  if (notes.length === 0) { doc.text('No notes.', MARGIN, y); y += 7 }
  for (const n of notes) {
    const lines = doc.splitTextToSize(`${fmtDate(n.createdAt)} — ${n.text}`, PAGE_W - MARGIN * 2)
    y = ensure(doc, y, lines.length * 6)
    doc.text(lines, MARGIN, y)
    y += lines.length * 6 + 2
  }
  y += 4
  y = section(doc, y, 'Photos')
  const before = (job.photos || []).filter((p) => p.kind === 'before').slice(0, 2)
  const after = (job.photos || []).filter((p) => p.kind === 'after').slice(0, 2)
  const shots = [...before.map((p) => ['Before', p]), ...after.map((p) => ['After', p])]
  if (shots.length === 0) { doc.text('No photos attached.', MARGIN, y) }
  for (const [label, p] of shots) {
    y = ensure(doc, y, 62)
    try {
      const fmt = (p.dataUrl || '').includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(p.dataUrl, fmt, MARGIN, y, 80, 56)
      doc.setFontSize(10)
      doc.text(label + (p.caption ? ' — ' + p.caption : ''), MARGIN + 86, y + 8)
    } catch (e) {
      doc.text(`${label} photo (could not embed)`, MARGIN, y + 8)
    }
    y += 62
  }
  footer(doc, `Work order — ${job.title || ''}`)
  return { filename: jobFileName(job, 'work-order'), base64: pdfBase64(doc), mime: 'application/pdf' }
}

export function contractPDF(job, settings) {
  const doc = new jsPDF()
  const bid = acceptedBid(job)
  const fin = jobActuals(job)
  const total = fin.quote || (bid ? bidTotal(bid) : 0)
  const plan = (job.paymentPlan && job.paymentPlan.length ? job.paymentPlan : defaultPaymentPlan())
    .map((m) => ({ ...m, amount: Math.round(total * ((Number(m.pct) || 0) / 100) * 100) / 100 }))
  draftStamp(doc)
  let y = header(doc, 'Carpentry Contract', settings, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const warn = 'DRAFT TEMPLATE - NOT LEGAL ADVICE. Have a local attorney review this contract before use. This template does not replace legal advice.'
  const warnLines = doc.splitTextToSize(warn, PAGE_W - MARGIN * 2)
  doc.text(warnLines, MARGIN, y)
  y += warnLines.length * 6 + 4
  y = kv(doc, y, 'Contractor:', settings.businessName || BRAND)
  y = kv(doc, y, 'Business address:', settings.businessAddress || '— (add a physical business address in Settings — HRRA requires it, and it must not be a P.O. Box)')
  y = licenseKv(doc, y, settings)
  y = kv(doc, y, 'Customer:', job.customerName || '—')
  y = kv(doc, y, 'Job address:', job.address || '—')
  y = kv(doc, y, 'Date:', fmtDate(todayISO()))
  y += 4
  y = ensure(doc, y, 30)
  y = section(doc, y, '1. Scope of work')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const scopeLines = doc.splitTextToSize((bid && bid.scope) || job.description || '—', PAGE_W - MARGIN * 2)
  doc.text(scopeLines, MARGIN, y)
  y += scopeLines.length * 6 + 2
  if (bid && (bid.finishGrade || bid.finishingBy)) {
    const finishParts = []
    if (bid.finishGrade) {
      const fg = FINISH_GRADES.find((g) => g.id === bid.finishGrade)?.label
      if (fg) finishParts.push(fg)
    }
    if (bid.finishingBy) {
      const fb = FINISHING_BY.find((g) => g.id === bid.finishingBy)?.label
      if (fb) finishParts.push(`finishing by ${fb}`)
    }
    if (finishParts.length) y = kv(doc, y, 'Finish:', finishParts.join(' — '))
  }
  y += 2
  y = ensure(doc, y, 30)
  y = section(doc, y, '2. Price')
  y = totalLine(doc, y, 'Contract price', total)
  if (bid) y = totalLine(doc, y, `Sales tax (${salesTaxRate(settings).toFixed(2)}% on taxable materials — collected with payments)`, bidTax(bid, settings))
  y = ensure(doc, y, 40)
  y = section(doc, y, '3. Payment schedule')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  for (const m of plan) {
    y = ensure(doc, y, 8)
    y = kv(doc, y, `${m.label} (${Number(m.pct) || 0}%):`, money(m.amount))
  }
  y += 2
  y = ensure(doc, y, 30)
  y = section(doc, y, '4. Timeline')
  y = kv(doc, y, 'Scheduled start:', fmtDate(job.scheduledDate))
  const hrra = job.hrra || {}
  y = kv(doc, y, 'Estimated completion:', fmtDate(hrra.estimatedCompletionDate || job.finishedDate))
  y += 2
  y = ensure(doc, y, 40)
  y = section(doc, y, '5. Change orders')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const coText = 'Any change to the scope or price must be written up as a change order, priced, and signed by both parties before the work starts. Verbal changes do not change this contract.'
  const coLines = doc.splitTextToSize(coText, PAGE_W - MARGIN * 2)
  doc.text(coLines, MARGIN, y)
  y += coLines.length * 6 + 4
  const cos = job.contract?.changeOrders || []
  for (const c of cos) {
    y = ensure(doc, y, 12)
    doc.text(`• ${c.title} — ${money(c.price)}${c.signedAt ? ' (signed ' + fmtDate(c.signedAt) + ')' : ' (unsigned)'}`, MARGIN, y)
    y += 7
  }
  y += 2
  y = ensure(doc, y, 40)
  y = section(doc, y, '6. Warranty')
  const wText = 'Workmanship is warranted for 12 months from completion against defects in labor. Materials are covered by the manufacturer warranty where one applies. This warranty does not cover normal wear, misuse, or changes made by others.'
  const wLines = doc.splitTextToSize(wText, PAGE_W - MARGIN * 2)
  doc.text(wLines, MARGIN, y)
  y += wLines.length * 6 + 4
  y = ensure(doc, y, 40)
  y = section(doc, y, '7. Material prices')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const mpText = 'Lumber and sheet-goods prices move between quote and build. If material prices rise before work starts, the contractor will re-quote the affected items and the new price must be agreed in writing before work starts. A fixed price with no material clause absorbs the difference — this clause exists so it does not.'
  const mpLines = doc.splitTextToSize(mpText, PAGE_W - MARGIN * 2)
  doc.text(mpLines, MARGIN, y)
  y += mpLines.length * 6 + 4
  y = ensure(doc, y, 40)
  y = section(doc, y, '8. Binding arbitration & jury trial waiver')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const arb = hrra.arbitration || {}
  const jury = hrra.juryWaiver || {}
  const arbText = arb.choice
    ? `Binding arbitration: ${arb.choice === 'accept' ? 'ACCEPTED' : 'REJECTED'} — initials ${arb.initials || '—'}, date ${fmtDate(arb.date)}.`
    : 'Binding arbitration: [ ] ACCEPTED  initials ______  date __________     [ ] REJECTED  initials ______  date __________'
  const juryText = jury.choice
    ? `Jury trial waiver: ${jury.choice === 'accept' ? 'ACCEPTED' : 'REJECTED'} — initials ${jury.initials || '—'}, date ${fmtDate(jury.date)}.`
    : 'Jury trial waiver: [ ] ACCEPTED  initials ______  date __________     [ ] REJECTED  initials ______  date __________'
  for (const t of [arbText, juryText]) {
    const lines = doc.splitTextToSize(t, PAGE_W - MARGIN * 2)
    y = ensure(doc, y, lines.length * 6 + 4)
    doc.text(lines, MARGIN, y)
    y += lines.length * 6 + 4
  }
  y = ensure(doc, y, 60)
  y = section(doc, y, '9. Home Repair: Know Your Consumer Rights (Illinois HRRA)')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const hrraAmountValue = hrraAmount(job, bidTotal)
  const hrraNote = hrraAmountValue > HRRA_THRESHOLD
    ? `This is a residential job over $1,000 (${money(hrraAmountValue)}), so the Illinois Home Repair and Remodeling Act applies. The contractor gave the homeowner the Illinois Attorney General's pamphlet "${HRRA_PAMPHLET_NAME}" before work began.`
    : `This job is $1,000 or under (${money(hrraAmountValue)}), so the HRRA pamphlet acknowledgment is not required for it.`
  const hrraNoteLines = doc.splitTextToSize(hrraNote, PAGE_W - MARGIN * 2)
  doc.text(hrraNoteLines, MARGIN, y)
  y += hrraNoteLines.length * 6 + 4
  doc.setFontSize(10)
  const pamLines = HRRA_PAMPHLET_SUMMARY.map((s) => `• ${s}`)
  for (const s of pamLines) {
    const lines = doc.splitTextToSize(s, PAGE_W - MARGIN * 2)
    y = ensure(doc, y, lines.length * 6 + 2)
    doc.text(lines, MARGIN, y)
    y += lines.length * 6 + 2
  }
  y += 2
  doc.setFontSize(11)
  const ack = hrra.pamphletAck || {}
  const ackText = ack.signedAt
    ? `Pamphlet acknowledgment: received and signed by ${ack.signedBy} on ${fmtDate(ack.signedAt)}.`
    : 'Pamphlet acknowledgment:  Received by ________________________________     Date: __________'
  y = ensure(doc, y, 8)
  doc.text(ackText, MARGIN, y)
  y += 10
  y = ensure(doc, y, 40)
  y = section(doc, y, '10. Signatures')
  y += 10
  doc.text('Customer: ________________________________     Date: __________', MARGIN, y)
  y += 14
  doc.text('Contractor: ________________________________     Date: __________', MARGIN, y)
  footer(doc, `Contract — ${job.title || ''} — DRAFT TEMPLATE - NOT LEGAL ADVICE`)
  return { filename: jobFileName(job, 'contract'), base64: pdfBase64(doc), mime: 'application/pdf' }
}

// Final-payment lien waiver. Generated when the job is complete and the
// final payment is in. DRAFT TEMPLATE - NOT LEGAL ADVICE.
export function lienWaiverPDF(job, settings) {
  const doc = new jsPDF()
  const fin = jobActuals(job)
  const waiver = job.lienWaiver || {}
  const finalPay = Number(waiver.finalPayment) || fin.revenue
  draftStamp(doc)
  let y = header(doc, 'Final Lien Waiver', settings, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const warn = 'DRAFT TEMPLATE - NOT LEGAL ADVICE. Have a local attorney review this waiver before use. Lien waiver rules vary by state.'
  const warnLines = doc.splitTextToSize(warn, PAGE_W - MARGIN * 2)
  doc.text(warnLines, MARGIN, y)
  y += warnLines.length * 6 + 4
  y = kv(doc, y, 'Contractor:', settings.businessName || BRAND)
  y = kv(doc, y, 'Customer:', job.customerName || '—')
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Job address:', job.address || '—')
  y = kv(doc, y, 'Date:', fmtDate(todayISO()))
  y += 4
  y = section(doc, y, 'Waiver')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const body = `For value received, the undersigned contractor waives and releases any and all lien rights, claims, and encumbrances on the property and work described above, for labor and materials furnished through the date of this waiver. This is a final waiver, given on receipt of final payment.`
  const bodyLines = doc.splitTextToSize(body, PAGE_W - MARGIN * 2)
  doc.text(bodyLines, MARGIN, y)
  y += bodyLines.length * 6 + 6
  y = totalLine(doc, y, 'Contract price', fin.quote)
  y = totalLine(doc, y, 'Total payments received', fin.revenue)
  y = totalLine(doc, y, 'Final payment covered by this waiver', finalPay)
  y = totalLine(doc, y, 'Balance due after this waiver', fin.balanceDue)
  y += 14
  y = ensure(doc, y, 40)
  doc.text('Contractor signature: ________________________________     Date: __________', MARGIN, y)
  y += 14
  doc.text('Printed name: ________________________________', MARGIN, y)
  footer(doc, `Lien waiver — ${job.title || ''} — DRAFT TEMPLATE - NOT LEGAL ADVICE`)
  return { filename: jobFileName(job, 'lien-waiver'), base64: pdfBase64(doc), mime: 'application/pdf' }
}

// Blank paper feedback form (same questions as the in-app form).
// Pass a feedback object to render a completed one instead.
export function feedbackPDF(job, fb, settings) {
  const doc = new jsPDF()
  let y = header(doc, fb ? 'Customer Feedback — completed' : 'Customer Feedback Form', settings, 16)
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Customer:', (fb && fb.customerName) || job.customerName || '—')
  y = kv(doc, y, 'Date:', fmtDate((fb && fb.createdAt) || new Date().toISOString()))
  y = kv(doc, y, 'Form:', fb ? (fb.kind === 'mid-job' ? 'Mid-job check-in' : 'Completion satisfaction') : 'Mid-job / completion')
  y += 4
  const rows = [
    ['Overall satisfaction (1–5 stars)', fb ? `${fb.stars || '—'} / 5` : '☆ ☆ ☆ ☆ ☆'],
    ['Quality of work (1–5)', fb ? String(fb.quality || '—') : '1  2  3  4  5'],
    ['Timeliness (1–5)', fb ? String(fb.timeliness || '—') : '1  2  3  4  5'],
    ['Communication (1–5)', fb ? String(fb.communication || '—') : '1  2  3  4  5'],
    ['Cleanliness (1–5)', fb ? String(fb.cleanliness || '—') : '1  2  3  4  5'],
  ]
  for (const [k, v] of rows) { y = kv(doc, y, k + ':', v); y += 2 }
  y += 4
  const free = [
    ['Concerns or issues', fb ? fb.concerns : ''],
    ['What could be improved', fb ? fb.improvements : ''],
    ['Your words about the job (testimonial)', fb ? fb.testimonial : ''],
  ]
  for (const [k, v] of free) {
    y = ensure(doc, y, 26)
    y = section(doc, y, k)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    if (v) {
      const lines = doc.splitTextToSize(String(v), PAGE_W - MARGIN * 2)
      doc.text(lines, MARGIN, y)
      y += lines.length * 6 + 4
    } else {
      for (let i = 0; i < 3; i++) { doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4); y += 9 }
      y += 2
    }
  }
  y = ensure(doc, y, 20)
  y = section(doc, y, 'Permission to quote you')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const consent = fb ? (fb.consent ? 'YES — my words may be used in ads.' : 'NO — do not use my words in ads.') : '☐ Yes, you may use my words in ads.     ☐ No, please do not.'
  const cLines = doc.splitTextToSize(consent, PAGE_W - MARGIN * 2)
  doc.text(cLines, MARGIN, y)
  y += cLines.length * 6 + 12
  doc.text('Customer signature: ________________________________     Date: __________', MARGIN, y)
  footer(doc, `Feedback — ${job.title || ''}`)
  const kind = fb ? 'feedback-completed' : 'feedback-form'
  return { filename: jobFileName(job, kind), base64: pdfBase64(doc), mime: 'application/pdf' }
}

// ---- Business plan PDF ----
// The full living plan as a printable document: reference sections,
// budget tables, milestones, and blueprint progress. Figures are the
// planning figures from the app — the vehicle row is blank on purpose
// (a running work vehicle is the gating item; no price is invented).
export function businessPlanPDF(store, settings) {
  const doc = new jsPDF()
  const biz = store.business || { blueprint: [], budget: { startup: [], monthly: [] }, milestones: [] }
  const prog = businessProgress(store)
  const stamp = fileStamp()
  let y = header(doc, 'Carpentry Business Plan', settings, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  y = kv(doc, y, 'Business:', settings.businessName || BRAND)
  y = kv(doc, y, 'Date:', fmtDate(todayISO()))
  y = kv(doc, y, 'Status:', `Blueprint ${prog.blueprintDone}/${prog.blueprintTotal} done • Milestones ${prog.milestonesDone}/${prog.milestonesTotal} done`)
  y += 4
  doc.setFontSize(10)
  const intro = 'Living document — the numbers and checklists in this plan are edited in the app (Business screen) and this PDF is re-exported from there. Budget figures are typical / planning ranges unless you have replaced them with your real numbers.'
  const introLines = doc.splitTextToSize(intro, PAGE_W - MARGIN * 2)
  doc.text(introLines, MARGIN, y)
  y += introLines.length * 6 + 6

  for (const s of PLAN_SECTIONS) {
    y = ensure(doc, y, 30)
    y = section(doc, y, s.title)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const para of s.body) {
      const lines = doc.splitTextToSize('•  ' + para, PAGE_W - MARGIN * 2)
      y = ensure(doc, y, lines.length * 6 + 2)
      doc.text(lines, MARGIN, y)
      y += lines.length * 6 + 2
    }
    y += 4
  }

  // Budgets.
  const budgetRows = (rows) => {
    let yy = y
    for (const r of rows) {
      yy = ensure(doc, yy, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      const labelLines = doc.splitTextToSize(r.label, 118)
      doc.text(labelLines, MARGIN, yy)
      const amt = r.amount === '' || r.amount === null || r.amount === undefined ? '—' : money(Number(r.amount) || 0)
      doc.text(amt, PAGE_W - MARGIN - 28, yy)
      yy += labelLines.length * 6
      if (r.note) {
        doc.setFontSize(9)
        doc.setTextColor(110)
        const noteLines = doc.splitTextToSize(r.note, PAGE_W - MARGIN * 2)
        doc.text(noteLines, MARGIN, yy)
        doc.setTextColor(0)
        yy += noteLines.length * 5 + 2
      }
      yy += 2
    }
    return yy
  }
  const sumRows = (rows) => rows.reduce((s, r) => s + (r.amount === '' ? 0 : (Number(r.amount) || 0)), 0)

  y = ensure(doc, y, 30)
  y = section(doc, y, 'Startup budget (lean)')
  y = budgetRows((biz.budget || {}).startup || [])
  y = totalLine(doc, y, 'Startup total (excl. vehicle)', sumRows((biz.budget || {}).startup || []))
  y += 6
  y = ensure(doc, y, 30)
  y = section(doc, y, 'Monthly operating costs')
  y = budgetRows((biz.budget || {}).monthly || [])
  y = totalLine(doc, y, 'Monthly total', sumRows((biz.budget || {}).monthly || []))
  y += 6

  // Milestones.
  y = ensure(doc, y, 30)
  y = section(doc, y, 'Milestones — 30 / 60 / 90 days')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  for (const horizon of ['30', '60', '90']) {
    y = ensure(doc, y, 14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${horizon} days`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    y += 7
    for (const ms of (biz.milestones || []).filter((m) => m.horizon === horizon)) {
      const lines = doc.splitTextToSize(`${ms.done ? '[x]' : '[ ]'}  ${ms.label}`, PAGE_W - MARGIN * 2)
      y = ensure(doc, y, lines.length * 6 + 2)
      doc.text(lines, MARGIN, y)
      y += lines.length * 6 + 2
    }
    y += 2
  }

  // Blueprint progress.
  y = ensure(doc, y, 30)
  y = section(doc, y, 'Startup-to-Finish blueprint — progress')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  for (const phase of biz.blueprint || []) {
    const items = phase.items || []
    const done = items.filter((i) => i.done).length
    y = ensure(doc, y, 8)
    doc.text(`${phase.title} — ${done}/${items.length} done`, MARGIN, y)
    y += 7
    for (const item of items.filter((i) => !i.done)) {
      const lines = doc.splitTextToSize(`[ ]  ${item.label}`, PAGE_W - MARGIN * 2)
      y = ensure(doc, y, lines.length * 6)
      doc.text(lines, MARGIN + 6, y)
      y += lines.length * 6 + 1
    }
    y += 2
  }
  y += 4
  doc.setFontSize(10)
  const ilNote = 'Illinois note: general carpentry and remodeling are regulated at the city/county level, not by a state license. Roofing and plumbing have state licenses. Confirm licensing, insurance, and tax items with your local licensing office and an accountant. This plan is a reference, not legal advice.'
  const ilLines = doc.splitTextToSize(ilNote, PAGE_W - MARGIN * 2)
  doc.text(ilLines, MARGIN, y)
  footer(doc, `Business plan — ${settings.businessName || BRAND}`)
  return { filename: `${slugify(settings.businessName || 'carpentry')}_business-plan_${stamp}.pdf`, base64: pdfBase64(doc), mime: 'application/pdf' }
}

// ---- Pay application PDF (G702/G703-style) ----
// Application for Payment + continuation sheet, built from the schedule
// of values and the application's snapshot. This is a TEMPLATE in the
// app's style — it is NOT an official AIA document and not legal advice.
// Do not present it as an AIA form.
export function payApplicationPDF(job, settings, app) {
  const doc = new jsPDF()
  const ps = progressSummary(job, settings)
  const stamp = fileStamp()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(185, 28, 28)
  doc.text('TEMPLATE — NOT AN OFFICIAL AIA FORM. NOT LEGAL ADVICE.', MARGIN, 12)
  doc.setTextColor(0)
  let y = header(doc, 'Application for Payment', settings, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const warn = 'G702/G703-style template. This is not an official AIA document. Have your contract and pay application reviewed before use on a commercial job.'
  const warnLines = doc.splitTextToSize(warn, PAGE_W - MARGIN * 2)
  doc.text(warnLines, MARGIN, y)
  y += warnLines.length * 6 + 4
  y = kv(doc, y, 'Contractor:', settings.businessName || BRAND)
  y = kv(doc, y, 'Customer / Owner:', job.customerName || '—')
  y = kv(doc, y, 'Job:', job.title || '—')
  y = kv(doc, y, 'Job address:', job.address || '—')
  y = kv(doc, y, 'Application #:', String(app.number))
  y = kv(doc, y, 'Period:', app.periodLabel || '—')
  y = kv(doc, y, 'Date:', fmtDate(app.date))
  y += 4
  y = section(doc, y, 'Summary (G702-style)')
  const rows = [
    ['Original contract sum (scheduled value)', money(ps.total)],
    ['Total earned to date', money(app.earnedToDate)],
    [`Less retainage (${Number(app.retainagePct) || 0}%)`, money(app.retainageHeld)],
    ['Total earned less retainage', money(app.lessRetainage)],
    ['Less previous certificates', money(app.previousCertificates)],
    ['CURRENT PAYMENT DUE', money(app.currentDue)],
    ['Balance to finish', money(app.balanceToFinish)],
    ['Retainage held to date', money(app.retainageHeld)],
    ['Retainage released to date', money(Number(job.retainageReleased) || 0)],
  ]
  for (const [k, v] of rows) { y = ensure(doc, y, 8); y = kv(doc, y, k + ':', v) }
  y += 8
  y = ensure(doc, y, 40)
  doc.text('Contractor: ________________________________     Date: __________', MARGIN, y)
  y += 14
  doc.text('Owner / Architect: ________________________________     Date: __________', MARGIN, y)
  y += 10

  // Continuation sheet (G703-style): schedule of values.
  y = ensure(doc, y, 30)
  y = section(doc, y, 'Continuation sheet — schedule of values')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const note = 'Percent complete and earned-to-date are as of this application. Previous billings are tracked on the application summary above.'
  const noteLines = doc.splitTextToSize(note, PAGE_W - MARGIN * 2)
  doc.text(noteLines, MARGIN, y)
  y += noteLines.length * 6 + 4
  const lines = job.scheduleOfValues || []
  if (lines.length === 0) {
    doc.text('No schedule of values on this job.', MARGIN, y)
    y += 8
  } else {
    const srows = lines.map((l) => {
      const earned = (Number(l.value) || 0) * ((Number(l.pctComplete) || 0) / 100)
      return [l.description || 'Line item', money(l.value), `${Number(l.pctComplete) || 0}%`, money(earned)]
    })
    y = table(doc, y, ['Item', 'Scheduled', '% done', 'Earned'], srows)
    y = totalLine(doc, y, 'Scheduled value total', ps.total)
    y = totalLine(doc, y, 'Earned to date', ps.earned)
  }
  footer(doc, `Pay application #${app.number} — ${job.title || ''} — TEMPLATE, NOT AN OFFICIAL AIA FORM`)
  return { filename: `${slugify(job.title || job.customerName || 'job')}_pay-application-${app.number}_${stamp}.pdf`, base64: pdfBase64(doc), mime: 'application/pdf' }
}
