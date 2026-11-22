import React, { useRef, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import {
  money, fmtDate, fmtDateTime, todayISO, daysFromTodayISO, nowISO, uid, bidTotal, bidSubtotal, bidMaterialsTotal,
  bidOverhead, effectiveLabor, acceptedBid, jobActuals, jobCodeChecklistDone, punchListDone,
  invoiceState, jobLaborRate, jobTimeTotals, openTimeEntry, timeEntryHours, fmtHours,
  warrantyExpiry, addMonthsISO, genJobCode, STATUS_LABELS, JOB_TYPES, CUSTOMER_TYPES,
  FINISH_GRADES, FINISHING_BY, INVOICE_STATES, slugify,
  defaultPaymentPlan, paymentPlanAmounts, hoursComparison,
  buildScheduleOfValues, newProgressApplication, progressSummary, retainagePctFor,
  salesTaxRate, bidTax, bidTotalWithTax, taxCollectedFor, bidTaxableMaterials,
  PAYMENT_TEMPLATES, paymentPlanFromTemplate, applyAssembly, ASSEMBLY_UNITS,
} from '../lib/store.js'
import { HRRA_THRESHOLD, HRRA_PAMPHLET_NAME, HRRA_PAMPHLET_SUMMARY, hrraAmount, hrraApplies, hrraAcknowledged } from '../lib/hrra.js'
import { quotePDF, invoicePDF, workOrderPDF, contractPDF, feedbackPDF, lienWaiverPDF, payApplicationPDF } from '../lib/pdf.js'
import { quotePreviewData, contractPreviewData, timesheetPreviewData, previewToText } from '../lib/docPreview.js'
import PreviewModal from '../components/PreviewModal.jsx'
import { askGemini, askGeminiVision, askGeminiAudio, extractJson, bidPhotoPrompt, bidDraftPrompt, receiptPrompt } from '../lib/gemini.js'
import { checkJobWeather } from '../lib/weather.js'
import { saveToDownloads, shareFile, shareText, copyText } from '../lib/files.js'
import { CODE_SECTIONS, checklistForJob } from '../lib/codeRef.js'
import { StatusPill, Confirm, Stars } from '../components/ui.jsx'

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n }

function dataUrlB64(dataUrl) {
  const i = (dataUrl || '').indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

export default function JobDetail({ job, store, onUpdate, onUpdateStore, onDelete, onEdit, goBack, goAi, toast, onCreateJob }) {
  const [tab, setTab] = useState('overview')
  const [showCompare, setShowCompare] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [doneBlock, setDoneBlock] = useState('')
  const [adText, setAdText] = useState(job.adDraft?.caption || '')
  const [fbKind, setFbKind] = useState('completion')
  const [fb, setFb] = useState({ stars: 5, quality: 5, timeliness: 5, communication: 5, cleanliness: 5, concerns: '', improvements: '', testimonial: '', consent: false, customerName: job.customerName || '' })
  const [viewPhoto, setViewPhoto] = useState(null)
  const [newBidLabel, setNewBidLabel] = useState('')
  const [preview, setPreview] = useState(null)
  const photoInputRef = useRef(null)
  const attachInputRef = useRef(null)
  const [pendingPhotoKind, setPendingPhotoKind] = useState('before')

  const settings = store.settings || {}
  const fin = jobActuals(job)
  const bid = acceptedBid(job)
  const checklistDone = jobCodeChecklistDone(job)
  const punchDone = punchListDone(job)
  const openChecklist = (job.codeChecklist || []).filter((c) => !c.checked && !c.na)
  const openPunch = (job.punchList || []).filter((p) => !p.done)

  function upd(fn) { onUpdate((draft) => { fn(draft); draft.updatedAt = nowISO() }) }

  // ---- status / outcome ----
  function setStatus(s) {
    // Illinois HRRA hard gate: a residential job over $1,000 cannot move
    // to Scheduled or In Progress until the customer has acknowledged
    // the "Home Repair: Know Your Consumer Rights" pamphlet (typed name +
    // date, recorded on the Contract tab). Jobs $1,000 and under skip it.
    if ((s === 'scheduled' || s === 'in-progress') && hrraApplies(job, bidTotal) && !hrraAcknowledged(job)) {
      setDoneBlock(`Illinois HRRA: this is a residential job over $1,000 (${money(hrraAmount(job, bidTotal))}). The customer must acknowledge the "${HRRA_PAMPHLET_NAME}" pamphlet — typed name + date on the Contract tab — before the job can move to ${s === 'scheduled' ? 'Scheduled' : 'In Progress'}.`)
      setTab('contract')
      return
    }
    if (s === 'done') {
      const blocks = []
      if (!checklistDone) blocks.push(`code checklist — ${openChecklist.length} item${openChecklist.length > 1 ? 's' : ''} still open`)
      if (!punchDone) blocks.push(`punch list — ${openPunch.length} item${openPunch.length > 1 ? 's' : ''} still open`)
      if (blocks.length > 0) {
        setDoneBlock(`Not finished yet: ${blocks.join('; ')}. Check them off (or mark N/A) before marking this job Done.`)
        setTab(!checklistDone ? 'code' : 'closeout')
        return
      }
      upd((d) => {
        d.status = 'done'; d.outcome = 'completed'; d.finishedDate = todayISO()
        if (d.warranty && !d.warranty.startDate) d.warranty.startDate = todayISO()
        if (d.warranty && d.warranty.startDate && Number(d.warranty.months) > 0) d.warranty.expiryDate = addMonthsISO(d.warranty.startDate, d.warranty.months)
      })
      toast('Job marked Done. Nice work.')
      return
    }
    upd((d) => { d.status = s; if (s === 'in-progress' && !d.startedDate) d.startedDate = todayISO() })
  }
  function markLost() {
    setConfirm({ title: 'Mark bid lost?', body: 'The job stays on record with all its bids, so you can see what was quoted. Nothing is deleted.', ok: 'Mark lost', fn: () => upd((d) => { d.status = 'lost'; d.outcome = 'lost' }) })
  }
  function cancelJob() {
    setConfirm({ title: 'Cancel this job?', body: 'The job stays on record as cancelled with its bids and notes. Nothing is deleted.', ok: 'Cancel job', fn: () => upd((d) => { d.status = 'cancelled'; d.outcome = 'cancelled' }) })
  }

  // ---- bids ----
  function addBid() {
    // New bids start with the pricing defaults from Settings (labor rate,
    // markup, overhead) and a valid-until date from the validity setting.
    const validityDays = Number(settings.quoteValidityDays ?? 30) || 0
    const validUntil = validityDays > 0
      ? daysFromTodayISO(validityDays)
      : ''
    upd((d) => {
      const b = { id: uid(), label: newBidLabel.trim() || `Bid ${(d.bids || []).length + 1}`, scope: d.description || '', materials: [], labor: 0, other: 0, createdAt: nowISO(), laborRate: Number(settings.defaultLaborRate) || 0, markupPct: Number(settings.defaultMarkupPct ?? 20) || 0, overheadPct: Number(settings.defaultOverheadPct) || 0, validUntil }
      d.bids = [...(d.bids || []), b]
    })
    setNewBidLabel('')
  }
  function acceptBid(bidId) {
    upd((d) => {
      d.acceptedBidId = bidId
      if (d.status === 'bid' || d.status === 'enquiry') d.status = 'accepted'
      // First accepted bid gets the default 50/40/10 payment plan.
      if (!d.paymentPlan || d.paymentPlan.length === 0) d.paymentPlan = defaultPaymentPlan()
    })
    toast('Bid accepted — it now drives the job price, with the 50/40/10 payment plan.')
  }
  function updateBid(bidId, patch) {
    upd((d) => { const b = d.bids.find((x) => x.id === bidId); if (b) Object.assign(b, patch) })
  }
  function addMaterial(bidId) {
    upd((d) => { const b = d.bids.find((x) => x.id === bidId); if (b) b.materials = [...(b.materials || []), { id: uid(), name: '', qty: 1, unitCost: 0, taxable: true }] })
  }
  // Material price book: fill a material line from a saved price-book entry
  // (name + unit price + taxable flag) instead of typing it by hand.
  function addMaterialFromPriceBook(bidId, itemId) {
    const item = (settings.priceBook || []).find((x) => x.id === itemId)
    if (!item) { toast('Pick a price-book item first.'); return }
    upd((d) => {
      const b = d.bids.find((x) => x.id === bidId)
      if (!b) return
      b.materials = [...(b.materials || []), { id: uid(), name: item.name, qty: 1, unitCost: Number(item.unitPrice) || 0, taxable: item.taxable !== false }]
    })
    toast(`${item.name} added — adjust the quantity on the line.`)
  }
  // Quote expiry nudges: extend, re-quote as a fresh editable draft, or
  // nudge the customer. Nothing is sent without the carpenter tapping it.
  function extendQuote(bidId) {
    const until = daysFromTodayISO(14)
    updateBid(bidId, { validUntil: until })
    toast(`Quote extended to ${fmtDate(until)}.`)
  }
  function requoteBid(bidId) {
    const src = (job.bids || []).find((b) => b.id === bidId)
    if (!src) return
    const validityDays = Number(settings.quoteValidityDays ?? 30) || 0
    const validUntil = validityDays > 0 ? daysFromTodayISO(validityDays) : ''
    upd((d) => {
      const copy = structuredClone(src)
      copy.id = uid()
      copy.label = `${src.label} (re-quote)`
      copy.createdAt = nowISO()
      copy.validUntil = validUntil
      d.bids = [...(d.bids || []), copy]
    })
    toast('Re-quote created as a new editable bid — adjust the price, then accept it when the customer agrees.')
  }
  async function nudgeCustomer(b) {
    const text = `Hi ${job.customerName || ''}, just checking in on the quote for "${job.title || 'the job'}" — ${money(bidTotal(b))}${b.validUntil ? `, good until ${fmtDate(b.validUntil)}` : ''}. Happy to answer any questions or lock in a start date. — ${settings.businessName || 'AtotheI Carpentry'}`
    try { toast(await shareText(text, 'Quote follow-up')) } catch (e) { toast(e.message || 'Share failed.') }
  }
  // Milestone reminder: drafts the text for one overdue unpaid milestone
  // and opens the share sheet — the carpenter taps send, nothing auto-sends.
  async function remindMilestone(m) {
    const text = `Hi ${job.customerName || ''}, this is ${settings.businessName || 'AtotheI Carpentry'}. A quick reminder — the "${m.label}" payment of ${money(m.amount)} for "${job.title || 'the job'}" was due ${fmtDate(m.due)}. Thanks!`
    try { toast(await shareText(text, 'Payment reminder')) } catch (e) { toast(e.message || 'Share failed.') }
  }
  // Weather check for a scheduled job: free Nominatim geocode + Open-Meteo
  // forecast for the scheduled date. Result is cached on the job; any
  // failure shows a plain note instead of an error.
  const [weatherBusy, setWeatherBusy] = useState(false)
  async function checkWeather() {
    if (weatherBusy) return
    setWeatherBusy(true)
    try {
      const res = await checkJobWeather(job)
      if (!res.ok) {
        const note = res.reason === 'no-address' ? 'Add a job address to check the weather.'
          : res.reason === 'no-date' ? 'Add a scheduled date to check the weather.'
          : res.reason === 'not-found' ? 'Could not find that address on the map — check the spelling.'
          : 'Could not reach the weather service — check again later.'
        toast(note)
        return
      }
      upd((d) => { d.weather = res })
      toast(res.rain ? 'Rain is likely that day — see the warning on the job.' : 'Weather checked — looks dry that day.')
    } finally {
      setWeatherBusy(false)
    }
  }
  function updateMaterial(bidId, matId, patch) {
    upd((d) => {
      const b = d.bids.find((x) => x.id === bidId)
      if (!b) return
      const m = (b.materials || []).find((x) => x.id === matId)
      if (m) Object.assign(m, patch)
    })
  }
  function removeMaterial(bidId, matId) {
    upd((d) => { const b = d.bids.find((x) => x.id === bidId); if (b) b.materials = (b.materials || []).filter((x) => x.id !== matId) })
  }
  function deleteBid(bidId) {
    setConfirm({ title: 'Delete this bid?', body: 'The bid and its materials are removed from the job. This cannot be undone — export a backup first if it matters.', ok: 'Delete bid', fn: () => upd((d) => { d.bids = (d.bids || []).filter((x) => x.id !== bidId); if (d.acceptedBidId === bidId) d.acceptedBidId = null }) })
  }

  // ---- quote assemblies ----
  function applyAssemblyToBid(assemblyId, bidId, qty) {
    const assembly = (store.assemblies || []).find((a) => a.id === assemblyId)
    const b = (job.bids || []).find((x) => x.id === bidId)
    if (!assembly || !b) return
    const patch = applyAssembly(b, assembly, qty)
    upd((d) => { const bb = d.bids.find((x) => x.id === bidId); if (bb) Object.assign(bb, patch) })
    toast(`Applied "${assembly.name}" × ${qty} — lines added to the bid.`)
  }
  function saveAssemblyFromBid(bidId, name, unit) {
    const b = (job.bids || []).find((x) => x.id === bidId)
    if (!b || !name.trim()) return
    const assembly = {
      id: uid(), name: name.trim(), unit: unit || 'each', note: 'Saved from a bid.',
      wastePct: 0, laborHours: Number(b.laborHours) || 0,
      lines: (b.materials || []).map((m) => ({ name: m.name, qty: Number(m.qty) || 0, unitCost: Number(m.unitCost) || 0, taxable: m.taxable !== false })),
    }
    if (onUpdateStore) onUpdateStore((s) => { s.assemblies = [...(s.assemblies || []), assembly] })
    toast(`Assembly "${assembly.name}" saved — reuse it on any bid.`)
  }
  function deleteAssembly(id) {
    if (onUpdateStore) onUpdateStore((s) => { s.assemblies = (s.assemblies || []).filter((a) => a.id !== id) })
  }

  // ---- photos / attachments ----
  async function addPhoto(kind) {
    try {
      const photo = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt })
      if (photo && photo.dataUrl) {
        upd((d) => { d.photos = [...(d.photos || []), { id: uid(), kind, dataUrl: photo.dataUrl, caption: '', createdAt: nowISO() }] })
        toast('Photo added.')
      }
    } catch (e) {
      setPendingPhotoKind(kind)
      if (photoInputRef.current) photoInputRef.current.click()
    }
  }
  function onPhotoFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      upd((d) => { d.photos = [...(d.photos || []), { id: uid(), kind: pendingPhotoKind, dataUrl: String(r.result), caption: file.name, createdAt: nowISO() }] })
      toast('Photo added.')
    }
    r.readAsDataURL(file)
    e.target.value = ''
  }
  function onAttachFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const kind = window.prompt('What kind of file is this? (contract / receipt / plan / permit / shop drawing / cut list / measurement / other)', 'other') || 'other'
    const r = new FileReader()
    r.onload = () => {
      upd((d) => { d.attachments = [...(d.attachments || []), { id: uid(), name: file.name, mime: file.type || 'application/octet-stream', size: file.size, dataUrl: String(r.result), kind, createdAt: nowISO() }] })
      toast('Attached: ' + file.name)
    }
    r.readAsDataURL(file)
    e.target.value = ''
  }
  async function downloadAttachment(a) {
    try {
      const where = await saveToDownloads(a.name, dataUrlB64(a.dataUrl), a.mime)
      toast(where)
    } catch (e) { toast(e.message || 'Download failed.') }
  }
  function deletePhoto(id) {
    setConfirm({ title: 'Delete this photo?', body: 'The photo is removed from the job.', ok: 'Delete', fn: () => upd((d) => { d.photos = (d.photos || []).filter((x) => x.id !== id) }) })
  }
  function deleteAttachment(id) {
    setConfirm({ title: 'Delete this file?', body: 'The attachment is removed from the job.', ok: 'Delete', fn: () => upd((d) => { d.attachments = (d.attachments || []).filter((x) => x.id !== id) }) })
  }

  // ---- PDFs ----
  async function makePdf(kind) {
    try {
      let out
      if (kind === 'quote') {
        const b = bid || (job.bids || [])[0]
        if (!b) { toast('Add a bid first — the quote needs line items.'); return }
        out = quotePDF(job, b, settings)
      } else if (kind === 'invoice') {
        if (!bid) { toast('Accept a bid first — the invoice is built from the accepted bid.'); return }
        out = invoicePDF(job, settings)
      } else if (kind === 'work-order') {
        out = workOrderPDF(job, settings)
      } else if (kind === 'contract') {
        if (!bid) { toast('Accept a bid first — the contract is built from the accepted bid.'); return }
        out = contractPDF(job, settings)
      } else if (kind === 'lien-waiver') {
        out = lienWaiverPDF(job, settings)
      }
      const where = await saveToDownloads(out.filename, out.base64, out.mime)
      toast(`${out.filename} — ${where}`)
    } catch (e) { toast('PDF failed: ' + (e.message || e)) }
  }
  async function sharePdf(kind) {
    try {
      let out
      if (kind === 'quote') { const b = bid || (job.bids || [])[0]; if (!b) { toast('Add a bid first.'); return } out = quotePDF(job, b, settings) }
      else if (kind === 'invoice') { if (!bid) { toast('Accept a bid first.'); return } out = invoicePDF(job, settings) }
      else if (kind === 'work-order') { out = workOrderPDF(job, settings) }
      else if (kind === 'contract') { if (!bid) { toast('Accept a bid first.'); return } out = contractPDF(job, settings) }
      else if (kind === 'lien-waiver') { out = lienWaiverPDF(job, settings) }
      await shareFile(out.filename, out.base64, out.mime, `${settings.businessName || 'AtotheI Carpentry'} — ${job.title}`)
      toast('Shared.')
    } catch (e) { toast(e.message || 'Share failed.') }
  }

  // ---- document preview ----
  // Same content as the matching PDF (same builders, same numbers) — the
  // user reads it before sending anything. Read-only; editing stays on the tabs.
  function showPreview(kind) {
    if (kind === 'quote') {
      const b = bid || (job.bids || [])[0]
      if (!b) { toast('Add a bid first — the quote needs line items.'); return }
      setPreview({ kind, data: quotePreviewData(job, b, settings), shareLabel: 'quote PDF' })
    } else if (kind === 'contract') {
      if (!bid) { toast('Accept a bid first — the contract is built from the accepted bid.'); return }
      setPreview({ kind, data: contractPreviewData(job, settings), shareLabel: 'contract PDF' })
    } else if (kind === 'timesheet') {
      setPreview({ kind, data: timesheetPreviewData(job, settings), shareLabel: 'timesheet' })
    }
  }
  async function sharePreview() {
    if (!preview) return
    try {
      if (preview.kind === 'timesheet') {
        // Timesheets have no PDF — share the same preview as text.
        toast(await shareText(previewToText(preview.data), `Timesheet — ${job.title || ''}`))
      } else {
        await sharePdf(preview.kind)
      }
      setPreview(null)
    } catch (e) { toast(e.message || 'Share failed.') }
  }

  // ---- feedback ----
  function saveFeedback() {
    const entry = {
      id: uid(), kind: fbKind, createdAt: nowISO(),
      customerName: fb.customerName || job.customerName || '',
      stars: num(fb.stars), quality: num(fb.quality), timeliness: num(fb.timeliness),
      communication: num(fb.communication), cleanliness: num(fb.cleanliness),
      concerns: (fb.concerns || '').trim(), improvements: (fb.improvements || '').trim(),
      testimonial: (fb.testimonial || '').trim(), consent: !!fb.consent,
    }
    upd((d) => {
      d.feedback = [...(d.feedback || []), entry]
      if (entry.concerns) {
        d.fixes = [...(d.fixes || []), { id: uid(), title: 'Feedback concern: ' + entry.concerns.slice(0, 60), description: entry.concerns, status: 'open', createdAt: nowISO(), doneAt: '' }]
      }
      if (entry.improvements) {
        d.followUps = [...(d.followUps || []), { id: uid(), title: 'Improve: ' + entry.improvements.slice(0, 60), dueDate: '', done: false, createdAt: nowISO(), doneAt: '' }]
      }
    })
    setFb({ stars: 5, quality: 5, timeliness: 5, communication: 5, cleanliness: 5, concerns: '', improvements: '', testimonial: '', consent: false, customerName: job.customerName || '' })
    toast(entry.concerns || entry.improvements ? 'Feedback saved — a fix/follow-up was created from it.' : 'Feedback saved.')
  }
  async function feedbackPdf(fbEntry) {
    try {
      const out = feedbackPDF(job, fbEntry || null, settings)
      const where = await saveToDownloads(out.filename, out.base64, out.mime)
      toast(`${out.filename} — ${where}`)
    } catch (e) { toast('PDF failed: ' + (e.message || e)) }
  }

  // ---- ads ----
  const approvedTestimonials = (job.feedback || []).filter((f) => f.consent && (f.testimonial || '').trim())
  function buildAd() {
    const lines = []
    lines.push(`🔨 ${job.title || 'Carpentry work'} — done right.`)
    lines.push('')
    const scope = (bid && bid.scope) || job.description
    if (scope) lines.push(scope)
    lines.push('')
    const t = approvedTestimonials[0]
    if (t) {
      const first = String(t.customerName || job.customerName || 'Customer').split(' ')[0]
      lines.push(`"${t.testimonial}" — ${first}, ${JOB_TYPES.find((x) => x.id === job.jobType)?.label || 'carpentry'} customer`)
      lines.push('')
    }
    lines.push('Message for a free quote.')
    if (settings.businessName) lines.push(settings.businessName)
    if (settings.businessPhone) lines.push(settings.businessPhone)
    const text = lines.join('\n')
    setAdText(text)
    upd((d) => { d.adDraft = { caption: text, savedAt: nowISO() } })
    setTab('ads')
    toast('Ad draft built. Check it before you post — only consented testimonials are used.')
  }
  async function shareAd() {
    if (!adText.trim()) { toast('Build the ad draft first.'); return }
    try {
      const res = await shareText(adText, `${settings.businessName || 'AtotheI Carpentry'} — ${job.title}`)
      toast(res)
    } catch (e) { toast(e.message || 'Share failed.') }
  }
  async function shareAdWithPhotos() {
    if (!adText.trim()) { toast('Build the ad draft first.'); return }
    try {
      const { cacheFile } = await import('../lib/files.js')
      const { Share } = await import('@capacitor/share')
      const shots = (job.photos || []).filter((p) => p.kind === 'after' || p.kind === 'before').slice(0, 4)
      if (shots.length === 0) { await shareAd(); return }
      const uris = []
      for (let i = 0; i < shots.length; i++) {
        const ext = (shots[i].dataUrl || '').includes('image/png') ? 'png' : 'jpg'
        uris.push(await cacheFile(`ad-photo-${i + 1}.${ext}`, dataUrlB64(shots[i].dataUrl)))
      }
      await Share.share({ title: 'Job ad', text: adText, files: uris, dialogTitle: 'Share ad' })
      toast('Shared with photos.')
    } catch (e) {
      await shareAd()
    }
  }
  async function copyAd() {
    if (!adText.trim()) { toast('Build the ad draft first.'); return }
    toast(await copyText(adText))
  }

  // ---- contract + HRRA ----
  function updateHrra(patch) {
    upd((d) => { d.hrra = { ...(d.hrra || { pamphletAck: {}, arbitration: {}, juryWaiver: {}, estimatedCompletionDate: '' }), ...patch } })
  }
  function recordHrraAck(name) {
    upd((d) => {
      d.hrra = d.hrra || { pamphletAck: {}, arbitration: {}, juryWaiver: {}, estimatedCompletionDate: '' }
      d.hrra.pamphletAck = { signedBy: name.trim(), signedAt: nowISO() }
    })
    toast('Pamphlet acknowledgment recorded — the HRRA gate is open for this job.')
  }
  function recordContractAcceptance() {
    const name = window.prompt('Customer name for the signature:', job.customerName || '') || ''
    if (!name.trim()) return
    upd((d) => { d.contract = { ...(d.contract || { changeOrders: [] }), signedAt: nowISO(), signedBy: name.trim(), acceptedInApp: true } })
    toast('Contract acceptance recorded.')
  }
  // A change order is priced (extra labor + materials), can carry a photo,
  // and needs the client's e-signature (typed name + date) BEFORE the
  // extra work starts. Unsigned = "not approved, do not start".
  function saveChangeOrder(co) {
    upd((d) => {
      d.contract = d.contract || { changeOrders: [] }
      d.contract.changeOrders = [...(d.contract.changeOrders || []), { ...co, id: uid(), signedAt: '', signedBy: '' }]
    })
    toast('Change order added — not approved until the customer signs it.')
  }
  function deleteChangeOrder(id) {
    setConfirm({ title: 'Delete this change order?', body: 'The change order is removed from the job.', ok: 'Delete', fn: () => upd((d) => { d.contract.changeOrders = (d.contract?.changeOrders || []).filter((x) => x.id !== id) }) })
  }
  function signChangeOrder(id) {
    const name = window.prompt('Signed by (customer name):', job.customerName || '') || ''
    if (!name.trim()) return
    upd((d) => {
      const c = (d.contract?.changeOrders || []).find((x) => x.id === id)
      if (c) { c.signedAt = nowISO(); c.signedBy = name.trim() }
    })
  }

  // ---- time tracking (GPS-stamped) ----
  // Clock in/out stamps GPS coordinates on the time entry (device
  // permission is requested in-app). If permission is denied or location
  // is unavailable, the entry is still saved — just without coordinates.
  async function getCoords() {
    try {
      await Geolocation.requestPermissions()
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      const r4 = (v) => Math.round(v * 10000) / 10000
      return { lat: r4(pos.coords.latitude), lng: r4(pos.coords.longitude) }
    } catch (e) { return null }
  }
  async function clockIn(worker) {
    const name = (worker || '').trim() || 'Jeramy'
    if (openTimeEntry(job)) { toast('Already clocked in — clock out first.'); return }
    const rate = jobLaborRate(job, settings.defaultLaborRate)
    const coords = await getCoords()
    upd((d) => { d.timeEntries = [...(d.timeEntries || []), { id: uid(), worker: name, clockIn: nowISO(), clockOut: '', rate, note: '', lat: coords?.lat ?? null, lng: coords?.lng ?? null, clockOutLat: null, clockOutLng: null }] })
    toast(coords ? `${name} clocked in at ${coords.lat}, ${coords.lng}.` : `${name} clocked in (no location — permission off or unavailable).`)
  }
  async function clockOut() {
    const open = openTimeEntry(job)
    if (!open) { toast('Nobody is clocked in right now.'); return }
    const coords = await getCoords()
    upd((d) => {
      const e = (d.timeEntries || []).find((x) => x.id === open.id)
      if (e) { e.clockOut = nowISO(); if (coords) { e.clockOutLat = coords.lat; e.clockOutLng = coords.lng } }
    })
    toast(`${open.worker} clocked out — ${fmtHours(timeEntryHours({ ...open, clockOut: nowISO() }))}. Hours feed the job P&L.`)
  }

  // ---- invoice ----
  function setInvoice(patch) {
    upd((d) => { d.invoice = { ...(d.invoice || { state: 'unsent' }), ...patch } })
  }
  async function sendInvoiceReminder() {
    const inv = job.invoice || {}
    const state = invoiceState(job)
    const balanceWithTax = fin.balanceDue + (bid ? bidTax(bid, settings) : 0)
    const text = `Hi ${job.customerName || ''}, this is ${settings.businessName || 'AtotheI Carpentry'}. A quick reminder about your invoice for "${job.title || 'the job'}" — balance due ${money(balanceWithTax)} (incl. sales tax)${inv.dueDate ? ` (was due ${fmtDate(inv.dueDate)})` : ''}. Thanks!`
    try { toast(await shareText(text, 'Invoice reminder')) } catch (e) { toast(e.message || 'Share failed.') }
  }
  function markInvoicePaid() {
    setConfirm({
      title: 'Mark invoice paid?',
      body: `Balance due is ${money(fin.balanceDue)}. This marks the invoice paid and records the final payment.`,
      ok: 'Mark paid',
      fn: () => upd((d) => {
        d.invoice = { ...(d.invoice || {}), state: 'paid', paidAt: nowISO() }
        if (fin.balanceDue > 0) d.payments = [...(d.payments || []), { id: uid(), label: 'Final payment', kind: 'final', amount: fin.balanceDue, date: todayISO() }]
      }),
    })
  }

  // ---- payment schedules (50/40/10 and 40/40/20 templates, editable per job) ----
  function applyPaymentTemplate(templateId) {
    const id = typeof templateId === 'string' ? templateId : '50-40-10'
    upd((d) => { d.paymentPlan = paymentPlanFromTemplate(id) })
    const label = (PAYMENT_TEMPLATES.find((t) => t.id === id) || PAYMENT_TEMPLATES[0]).label
    toast(`Payment plan set to ${label}.`)
  }
  function updateMilestone(id, patch) {
    upd((d) => {
      const m = (d.paymentPlan || []).find((x) => x.id === id)
      if (m) Object.assign(m, patch)
    })
  }
  function addMilestone() {
    upd((d) => { d.paymentPlan = [...(d.paymentPlan || []), { id: uid(), label: 'Milestone', pct: 0, due: '', paid: false }] })
  }
  function removeMilestone(id) {
    upd((d) => { d.paymentPlan = (d.paymentPlan || []).filter((x) => x.id !== id) })
  }

  // ---- progress billing (AIA-style) ----
  function setBillingType(t) {
    upd((d) => { d.billingType = t })
    toast(t === 'progress' ? 'Progress billing on — build the schedule of values from the accepted bid.' : 'Milestone billing on — the 50/40/10 schedule.')
  }
  function buildSov() {
    if (!bid) { toast('Accept a bid first — the schedule of values is built from it.'); return }
    upd((d) => { d.scheduleOfValues = buildScheduleOfValues(d) })
    toast('Schedule of values built from the accepted bid.')
  }
  function rebuildSov() {
    setConfirm({ title: 'Rebuild schedule of values?', body: 'Line percents reset to 0. Previous pay applications stay on record.', ok: 'Rebuild', fn: () => buildSov() })
  }
  function setSovLine(id, patch) {
    upd((d) => { const l = (d.scheduleOfValues || []).find((x) => x.id === id); if (l) Object.assign(l, patch) })
  }
  function addSovLine() {
    upd((d) => { d.scheduleOfValues = [...(d.scheduleOfValues || []), { id: uid(), description: '', value: 0, pctComplete: 0 }] })
  }
  function removeSovLine(id) {
    upd((d) => { d.scheduleOfValues = (d.scheduleOfValues || []).filter((x) => x.id !== id) })
  }
  function createApplication(periodLabel) {
    const app = newProgressApplication(job, settings, periodLabel)
    upd((d) => { d.progressApplications = [...(d.progressApplications || []), app] })
    toast(`Application #${app.number} created — current due ${money(app.currentDue)}.`)
  }
  function markApplicationPaid(id) {
    const app = (job.progressApplications || []).find((a) => a.id === id)
    if (!app) return
    setConfirm({
      title: `Mark application #${app.number} paid?`,
      body: `Records a progress payment of ${money(app.currentDue)}.`,
      ok: 'Mark paid',
      fn: () => upd((d) => {
        const a = (d.progressApplications || []).find((x) => x.id === id)
        if (a) a.status = 'paid'
        if (app.currentDue > 0) d.payments = [...(d.payments || []), { id: uid(), label: `Progress payment — Application #${app.number}`, kind: 'progress', amount: app.currentDue, date: todayISO() }]
      }),
    })
  }
  function releaseRetainage() {
    const s = progressSummary(job, settings)
    if (s.retainageHeld <= 0) { toast('No retainage held right now.'); return }
    setConfirm({
      title: 'Release retainage?',
      body: `Releases ${money(s.retainageHeld)} held retainage and records it as a final payment. Do this at completion, with the final walkthrough.`,
      ok: 'Release retainage',
      fn: () => upd((d) => {
        const held = progressSummary(d, settings).retainageHeld
        d.retainageReleased = (Number(d.retainageReleased) || 0) + held
        if (held > 0) d.payments = [...(d.payments || []), { id: uid(), label: 'Retainage released', kind: 'final', amount: held, date: todayISO() }]
      }),
    })
  }
  async function makePayAppPdf(appId) {
    const app = (job.progressApplications || []).find((a) => a.id === appId) || (job.progressApplications || []).slice(-1)[0]
    if (!app) { toast('Create a pay application first.'); return }
    try {
      const out = payApplicationPDF(job, settings, app)
      const where = await saveToDownloads(out.filename, out.base64, out.mime)
      toast(`${out.filename} — ${where}`)
    } catch (e) { toast('PDF failed: ' + (e.message || e)) }
  }
  async function sharePayAppPdf(appId) {
    const app = (job.progressApplications || []).find((a) => a.id === appId) || (job.progressApplications || []).slice(-1)[0]
    if (!app) { toast('Create a pay application first.'); return }
    try {
      const out = payApplicationPDF(job, settings, app)
      await shareFile(out.filename, out.base64, out.mime, `${settings.businessName || 'AtotheI Carpentry'} — Pay application #${app.number}`)
      toast('Shared.')
    } catch (e) { toast(e.message || 'Share failed.') }
  }

  // ---- lien waiver ----
  function recordLienWaiver() {
    const amount = window.prompt('Final payment covered by this waiver ($):', String(fin.revenue || 0)) || '0'
    upd((d) => { d.lienWaiver = { ...(d.lienWaiver || {}), generatedAt: nowISO(), finalPayment: num(amount) } })
    toast('Lien waiver details saved — generate the PDF to share it.')
  }

  // ---- generic adders ----
  function addNote(text) {
    if (!text.trim()) return
    upd((d) => { d.notes = [...(d.notes || []), { id: uid(), text: text.trim(), createdAt: nowISO() }] })
  }
  function addFix(title, warranty) {
    if (!title.trim()) return
    upd((d) => { d.fixes = [...(d.fixes || []), { id: uid(), title: title.trim(), description: '', status: 'open', warranty: !!warranty, createdAt: nowISO(), doneAt: '' }] })
  }
  function addFollowUp(title, dueDate) {
    if (!title.trim()) return
    upd((d) => { d.followUps = [...(d.followUps || []), { id: uid(), title: title.trim(), dueDate: dueDate || '', done: false, createdAt: nowISO(), doneAt: '' }] })
  }
  function addExpense(label, category, amount, extra) {
    if (!label.trim()) return
    upd((d) => { d.expenses = [...(d.expenses || []), { id: uid(), label: label.trim(), category, amount: num(amount), date: (extra && extra.date) || todayISO(), vendor: (extra && extra.vendor) || '', photo: (extra && extra.photo) || '', receipt: !!(extra && extra.receipt) }] })
  }
  function addPayment(label, kind, amount) {
    if (!label.trim()) return
    upd((d) => { d.payments = [...(d.payments || []), { id: uid(), label: label.trim(), kind, amount: num(amount), date: todayISO() }] })
  }
  function addTool(name, owned, rentalCost) {
    if (!name.trim()) return
    upd((d) => { d.tools = [...(d.tools || []), { id: uid(), name: name.trim(), owned, rentalCost: owned ? 0 : num(rentalCost) }] })
  }
  function toggleChecklist(id, field) {
    upd((d) => {
      const c = (d.codeChecklist || []).find((x) => x.id === id)
      if (!c) return
      if (field === 'checked') { c.checked = !c.checked; if (c.checked) c.na = false }
      if (field === 'na') { c.na = !c.na; if (c.na) c.checked = false }
    })
  }
  function rebuildChecklist() {
    upd((d) => { d.codeChecklist = checklistForJob(d) })
    toast('Code checklist rebuilt from the linked sections.')
  }

  // ---- customer code + links (generic code + public-JSON pattern) ----
  function regenerateCode() {
    setConfirm({
      title: 'New code for this job?',
      body: 'The old status link stops working. The new code is unique across all jobs.',
      ok: 'Generate new code',
      fn: () => {
        const taken = (store.jobs || []).filter((j) => j.id !== job.id).map((j) => j.jobCode)
        const code = genJobCode(taken)
        upd((d) => { d.jobCode = code })
        toast('New code: ' + code)
      },
    })
  }
  function ensureCode() {
    const taken = (store.jobs || []).filter((j) => j.id !== job.id).map((j) => j.jobCode)
    const code = genJobCode(taken)
    upd((d) => { d.jobCode = code })
    toast('Code: ' + code)
  }
  const statusLink = job.jobCode && settings.statusPageUrl ? `${settings.statusPageUrl}?code=${job.jobCode}` : ''
  const feedbackLink = settings.feedbackFormUrl || ''
  async function copyLink(text, label) {
    if (!text) { toast('Set the link up in Settings first.'); return }
    toast(await copyText(text))
  }
  async function shareLink(text, label) {
    if (!text) { toast('Set the link up in Settings first.'); return }
    try { toast(await shareText(text, label)) } catch (e) { toast(e.message || 'Share failed.') }
  }

  const tabs = [
    ['overview', 'Overview'], ['bids', 'Bids'], ['money', 'Money'], ['time', 'Time'],
    ['photos', 'Photos & Files'], ['fixes', 'Fixes'], ['followups', 'Follow-ups'],
    ['code', 'Code'], ['contract', 'Contract'], ['closeout', 'Closeout'],
    ['feedback', 'Feedback'], ['ads', 'Ads'],
  ]

  return (
    <div className="page">
      <button className="small" onClick={goBack}>← All jobs</button>
      <div className="row between" style={{ marginTop: 8 }}>
        <h1 style={{ margin: 0 }}>{job.title || 'Untitled job'}</h1>
        <StatusPill status={job.status} />
      </div>
      <p className="muted">{job.customerName}{job.phone ? ' • ' + job.phone : ''}{job.address ? ' • ' + job.address : ''}</p>
      <p className="muted">{JOB_TYPES.find((t) => t.id === job.jobType)?.label || ''}{job.customerType ? ` • ${CUSTOMER_TYPES.find((t) => t.id === job.customerType)?.label || job.customerType}` : ''}{job.outcome ? ` • Outcome: ${job.outcome}` : ''}</p>

      <div className="chips">
        {tabs.map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {doneBlock && (
        <div className="kbd-note" style={{ marginBottom: 12 }}>{doneBlock} <button className="small" onClick={() => setDoneBlock('')}>Dismiss</button></div>
      )}

      {tab === 'overview' && (
        <OverviewTab job={job} fin={fin} bid={bid} onUpdate={upd} setStatus={setStatus} markLost={markLost} cancelJob={cancelJob} goAi={goAi} settings={settings} toast={toast} regenerateCode={regenerateCode} ensureCode={ensureCode} statusLink={statusLink} feedbackLink={feedbackLink} copyLink={copyLink} shareLink={shareLink} checkWeather={checkWeather} weatherBusy={weatherBusy} />
      )}

      {tab === 'bids' && (
        <BidsTab
          job={job} showCompare={showCompare} setShowCompare={setShowCompare}
          newBidLabel={newBidLabel} setNewBidLabel={setNewBidLabel}
          addBid={addBid} acceptBid={acceptBid} updateBid={updateBid}
          addMaterial={addMaterial} updateMaterial={updateMaterial} removeMaterial={removeMaterial}
          addMaterialFromPriceBook={addMaterialFromPriceBook} extendQuote={extendQuote} requoteBid={requoteBid} nudgeCustomer={nudgeCustomer}
          deleteBid={deleteBid} makePdf={makePdf} sharePdf={sharePdf} onPreview={() => showPreview('quote')}
          settings={settings} toast={toast} onUpdate={upd}
          assemblies={store.assemblies || []} applyAssemblyToBid={applyAssemblyToBid}
          saveAssemblyFromBid={saveAssemblyFromBid} deleteAssembly={deleteAssembly}
        />
      )}

      {tab === 'money' && (
        <MoneyTab job={job} fin={fin} bid={bid} addExpense={addExpense} addPayment={addPayment} addTool={addTool} onUpdate={upd} settings={settings} toast={toast} setInvoice={setInvoice} sendInvoiceReminder={sendInvoiceReminder} markInvoicePaid={markInvoicePaid} remindMilestone={remindMilestone} makePdf={makePdf} sharePdf={sharePdf} applyPaymentTemplate={applyPaymentTemplate} updateMilestone={updateMilestone} addMilestone={addMilestone} removeMilestone={removeMilestone} setBillingType={setBillingType} buildSov={buildSov} rebuildSov={rebuildSov} setSovLine={setSovLine} addSovLine={addSovLine} removeSovLine={removeSovLine} createApplication={createApplication} markApplicationPaid={markApplicationPaid} releaseRetainage={releaseRetainage} makePayAppPdf={makePayAppPdf} sharePayAppPdf={sharePayAppPdf} />
      )}

      {tab === 'time' && (
        <TimeTab job={job} onUpdate={upd} clockIn={clockIn} clockOut={clockOut} settings={settings} onPreview={() => showPreview('timesheet')} />
      )}

      {tab === 'photos' && (
        <PhotosTab
          job={job} addPhoto={addPhoto} deletePhoto={deletePhoto} setViewPhoto={setViewPhoto}
          onAttachFile={onAttachFile} downloadAttachment={downloadAttachment} deleteAttachment={deleteAttachment}
          attachInputRef={attachInputRef} makePdf={makePdf} sharePdf={sharePdf}
        />
      )}

      {tab === 'fixes' && <FixesTab job={job} onUpdate={upd} addFix={addFix} />}
      {tab === 'followups' && <FollowUpsTab job={job} onUpdate={upd} addFollowUp={addFollowUp} />}

      {tab === 'code' && (
        <CodeTab job={job} onUpdate={upd} toggleChecklist={toggleChecklist} rebuildChecklist={rebuildChecklist} />
      )}

      {tab === 'contract' && (
        <ContractTab job={job} bid={bid} fin={fin} makePdf={makePdf} sharePdf={sharePdf} onPreview={() => showPreview('contract')} recordContractAcceptance={recordContractAcceptance} saveChangeOrder={saveChangeOrder} deleteChangeOrder={deleteChangeOrder} signChangeOrder={signChangeOrder} updateHrra={updateHrra} recordHrraAck={recordHrraAck} settings={settings} toast={toast} />
      )}

      {tab === 'closeout' && (
        <CloseoutTab job={job} fin={fin} onUpdate={upd} makePdf={makePdf} sharePdf={sharePdf} recordLienWaiver={recordLienWaiver} settings={settings} toast={toast} onCreateJob={onCreateJob} />
      )}

      {tab === 'feedback' && (
        <FeedbackTab job={job} fb={fb} setFb={setFb} fbKind={fbKind} setFbKind={setFbKind} saveFeedback={saveFeedback} feedbackPdf={feedbackPdf} />
      )}

      {tab === 'ads' && (
        <AdsTab job={job} adText={adText} setAdText={setAdText} buildAd={buildAd} shareAd={shareAd} shareAdWithPhotos={shareAdWithPhotos} copyAd={copyAd} approvedTestimonials={approvedTestimonials} />
      )}

      <hr className="hr" />
      <div className="row wrap">
        <button className="small" onClick={onEdit}>Edit job details</button>
        <button className="small" onClick={() => goAi(job.id)}>Ask Gemini about this job</button>
        <button className="small danger" onClick={() => setConfirm({ title: 'Delete this job?', body: 'The whole job — bids, photos, notes, everything — is deleted. Export a backup first if it matters. This cannot be undone.', ok: 'Delete job', fn: onDelete })}>Delete job</button>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoFile} />
      <input ref={attachInputRef} type="file" style={{ display: 'none' }} onChange={onAttachFile} />

      {viewPhoto && (
        <div className="modal-back" onClick={() => setViewPhoto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img className="thumb" src={viewPhoto.dataUrl} alt={viewPhoto.caption || 'job photo'} />
            <p className="muted">{viewPhoto.kind} photo • {fmtDateTime(viewPhoto.createdAt)}</p>
            <button className="block" onClick={() => setViewPhoto(null)}>Close</button>
          </div>
        </div>
      )}
      {confirm && <Confirm title={confirm.title} body={confirm.body} okLabel={confirm.ok} onOk={() => { const f = confirm.fn; setConfirm(null); f() }} onCancel={() => setConfirm(null)} />}
      {preview && <PreviewModal doc={preview.data} shareLabel={preview.shareLabel} onClose={() => setPreview(null)} onShare={sharePreview} />}
    </div>
  )
}

// ---------- tab components ----------

function OverviewTab({ job, fin, bid, onUpdate, setStatus, markLost, cancelJob, goAi, settings, toast, regenerateCode, ensureCode, statusLink, feedbackLink, copyLink, shareLink, checkWeather, weatherBusy }) {
  const [note, setNote] = useState('')
  const [editDesc, setEditDesc] = useState(job.description || '')
  const [recState, setRecState] = useState('')
  const [transcribing, setTranscribing] = useState('')
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const hasDeposit = (job.payments || []).some((p) => p.kind === 'deposit')
  const daysToStart = job.scheduledDate ? Math.round((new Date(job.scheduledDate) - new Date(todayISO())) / 86400000) : null
  const depositSoon = job.scheduledDate && daysToStart != null && daysToStart <= 7 && !hasDeposit && ['accepted', 'scheduled', 'in-progress'].includes(job.status)

  // Voice notes: record on site with the phone mic, save on the job, play
  // back in-app. Transcribe with Gemini is optional (your key) — it turns
  // the recording into a text note too. If transcription fails, the
  // recording stays and a manual note still works.
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const r = new FileReader()
        r.onload = () => {
          onUpdate((d) => { d.voiceNotes = [...(d.voiceNotes || []), { id: uid(), createdAt: nowISO(), dataUrl: String(r.result), mimeType: blob.type, transcript: '' }] })
          setRecState('')
        }
        r.readAsDataURL(blob)
      }
      recRef.current = rec
      rec.start()
      setRecState('recording')
    } catch (e) {
      toast('Could not start recording: ' + (e.message || e))
    }
  }
  function stopRecording() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }
  async function transcribeNote(vn) {
    if (!settings.geminiApiKey) { toast('Add your Gemini key in Settings to transcribe voice notes.'); return }
    setTranscribing(vn.id)
    try {
      const text = await askGeminiAudio(settings.geminiApiKey, settings.geminiModel, 'Transcribe this voice note word for word. Return only the transcription, no extra text.', vn.dataUrl)
      const t = text.trim()
      onUpdate((d) => {
        const v = (d.voiceNotes || []).find((x) => x.id === vn.id)
        if (v) v.transcript = t
        d.notes = [...(d.notes || []), { id: uid(), text: `🎙 Voice note: ${t}`, createdAt: nowISO() }]
      })
      toast('Transcribed — added as a text note too.')
    } catch (e) {
      toast('Transcription failed: ' + (e.message || e) + ' — the recording is still saved.')
    } finally {
      setTranscribing('')
    }
  }
  return (
    <div>
      <div className="card">
        <h2>Job</h2>
        <p>{job.description || 'No description yet.'}</p>
        <label>Description / scope</label>
        <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => { onUpdate((d) => { d.description = editDesc }); }}>Save description</button>
        </div>
        <hr className="hr" />
        <div className="grid2">
          <div><label>Scheduled</label><input type="date" value={job.scheduledDate || ''} onChange={(e) => onUpdate((d) => { d.scheduledDate = e.target.value })} /></div>
          <div><label>Started</label><input type="date" value={job.startedDate || ''} onChange={(e) => onUpdate((d) => { d.startedDate = e.target.value })} /></div>
        </div>
        <div className="grid2">
          <div><label>Finished</label><input type="date" value={job.finishedDate || ''} onChange={(e) => onUpdate((d) => { d.finishedDate = e.target.value })} /></div>
          <div><label>Job type</label>
            <select value={job.jobType} onChange={(e) => onUpdate((d) => { d.jobType = e.target.value; d.codeChecklist = checklistForJob({ ...d, jobType: e.target.value }) })}>
              {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <hr className="hr" />
        <h3>Weather for the scheduled day</h3>
        {job.weather && job.weather.ok && job.weather.date === job.scheduledDate ? (
          <p style={job.weather.rain ? { color: 'var(--warn)' } : {}}>{job.weather.rain ? '🌧 ' : '☀️ '}{job.weather.summary} <span className="muted">(checked {fmtDateTime(job.weather.checkedAt)})</span></p>
        ) : (
          <p className="muted">Free forecast for the scheduled date — needs a job address and a scheduled date. Nothing is sent until you tap it.</p>
        )}
        <div className="row wrap">
          <button className="small" onClick={checkWeather} disabled={weatherBusy}>{weatherBusy ? 'Checking…' : '🌦 Check weather'}</button>
        </div>
      </div>

      <div className="card">
        <h2>Status</h2>
        <div className="chips">
          {['enquiry', 'bid', 'accepted', 'scheduled', 'in-progress', 'follow-up'].map((s) => (
            <button key={s} className={`chip ${job.status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{STATUS_LABELS[s]}</button>
          ))}
        </div>
        {job.status === 'enquiry' && (
          <p><button className="primary" onClick={() => setStatus('bid')}>→ Convert to bid</button> <span className="muted">One tap — the enquiry becomes a bid and you build the quote on the Bids tab.</span></p>
        )}
        <div className="row wrap">
          <button className="primary" onClick={() => setStatus('done')}>Mark Done</button>
          <button onClick={markLost}>Bid lost</button>
          <button onClick={cancelJob}>Cancel job</button>
        </div>
        <p className="muted">Marking Done needs the code checklist (Code tab) and the punch list (Closeout tab) finished, and records the outcome as completed.</p>
      </div>

      <div className="card">
        <h2>Customer code &amp; links</h2>
        {job.jobCode ? (
          <p>Job code: <b style={{ fontSize: 22, letterSpacing: 2 }}>{job.jobCode}</b></p>
        ) : (
          <p className="muted">No code yet on this job.</p>
        )}
        <div className="row wrap">
          {job.jobCode
            ? <button className="small" onClick={regenerateCode}>New code</button>
            : <button className="small primary" onClick={ensureCode}>Generate code</button>}
        </div>
        {job.jobCode && (
          <div style={{ marginTop: 10 }}>
            <p className="muted">Status link (customer checks progress):</p>
            <p style={{ wordBreak: 'break-all' }}>{statusLink}</p>
            <div className="row wrap">
              <button className="small" onClick={() => copyLink(statusLink, 'Status link')}>Copy status link</button>
              <button className="small" onClick={() => shareLink(statusLink, 'Job status')}>Share status link</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>Feedback form link:</p>
            {feedbackLink ? (
              <p style={{ wordBreak: 'break-all' }}>{feedbackLink}</p>
            ) : (
              <p className="muted">No feedback form set yet — add your Google Form URL in Settings.</p>
            )}
            <div className="row wrap">
              <button className="small" onClick={() => copyLink(feedbackLink, 'Feedback form')}>Copy feedback link</button>
              <button className="small" onClick={() => shareLink(feedbackLink, 'Feedback form')}>Share feedback link</button>
            </div>
            <p className="muted">The status page shows only first name, job type, and status. A code is not a password — it only opens that one public lookup.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Money at a glance</h2>
        <p>Quoted (accepted bid + change orders): <b className="money">{money(fin.quote)}</b></p>
        <p>Payments in: <b className="money">{money(fin.revenue)}</b> • Balance due: <b className="money">{money(fin.balanceDue)}</b></p>
        <p>Actual costs: <b className="money">{money(fin.totalCosts)}</b> • Profit/loss: <b className={`money ${fin.profit >= 0 ? 'pos' : 'neg'}`}>{money(fin.profit)}</b></p>
        {depositSoon && (
          <p style={{ color: 'var(--warn)' }}>⚠️ No deposit recorded yet — this job starts {fmtDate(job.scheduledDate)} ({daysToStart <= 0 ? 'today' : `in ${daysToStart} day${daysToStart === 1 ? '' : 's'}`}). Record the deposit on the Money tab before you load up.</p>
        )}
        <p className="muted">Full breakdown on the Money tab.</p>
      </div>

      <div className="card">
        <h2>Notes</h2>
        {(job.notes || []).slice().reverse().map((n) => (
          <p key={n.id}><span className="muted">{fmtDateTime(n.createdAt)} — </span>{n.text}</p>
        ))}
        {(job.notes || []).length === 0 && <p className="muted">No notes yet.</p>}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a timestamped note…" />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small primary" onClick={() => { if (!note.trim()) return; onUpdate((d) => { d.notes = [...(d.notes || []), { id: uid(), text: note.trim(), createdAt: nowISO() }] }); setNote('') }}>Add note</button>
        </div>
        <h3 style={{ marginTop: 16 }}>Voice notes</h3>
        <p className="muted">Record on site — it saves on the job. Transcribe with Gemini turns it into a text note (needs your key).</p>
        {(job.voiceNotes || []).map((vn) => (
          <div key={vn.id} style={{ marginBottom: 10 }}>
            <audio controls src={vn.dataUrl} style={{ width: '100%' }} />
            <p className="muted">{fmtDateTime(vn.createdAt)}{vn.transcript ? ` — ${vn.transcript}` : ''}</p>
            <div className="row wrap">
              {!vn.transcript && <button className="small" disabled={transcribing === vn.id} onClick={() => transcribeNote(vn)}>{transcribing === vn.id ? 'Transcribing…' : '🎙 Transcribe with Gemini'}</button>}
              <button className="small" onClick={() => onUpdate((d) => { d.voiceNotes = (d.voiceNotes || []).filter((x) => x.id !== vn.id) })}>Delete</button>
            </div>
          </div>
        ))}
        {(job.voiceNotes || []).length === 0 && <p className="muted">No voice notes yet.</p>}
        <div className="row wrap" style={{ marginTop: 8 }}>
          {recState === 'recording'
            ? <button className="small danger" onClick={stopRecording}>■ Stop recording</button>
            : <button className="small dark" onClick={startRecording}>🎙 Record voice note</button>}
          {recState === 'recording' && <span className="muted">Recording… tap stop when you are done.</span>}
        </div>
      </div>
    </div>
  )
}

function BidsTab({ job, showCompare, setShowCompare, newBidLabel, setNewBidLabel, addBid, acceptBid, updateBid, addMaterial, updateMaterial, removeMaterial, addMaterialFromPriceBook, extendQuote, requoteBid, nudgeCustomer, deleteBid, makePdf, sharePdf, onPreview, settings, toast, onUpdate, assemblies, applyAssemblyToBid, saveAssemblyFromBid, deleteAssembly }) {
  const bids = job.bids || []
  const [analyzing, setAnalyzing] = useState('')
  const [analysisFor, setAnalysisFor] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftFor, setDraftFor] = useState('')
  const [pbId, setPbId] = useState('')
  const accepted = bids.find((x) => x.id === job.acceptedBidId) || null
  const checked = job.shoppingChecked || {}
  const [asmId, setAsmId] = useState('')
  const [asmQty, setAsmQty] = useState('')
  const [asmBidId, setAsmBidId] = useState('')
  const [saveAsmName, setSaveAsmName] = useState('')
  const [saveAsmUnit, setSaveAsmUnit] = useState('each')
  const [saveAsmBidId, setSaveAsmBidId] = useState('')

  function setMeasurements(bidId, patch) {
    const b = bids.find((x) => x.id === bidId)
    if (!b) return
    const m = { ...(b.measurements || {}), ...patch }
    // Auto sq ft from length x width when both are entered.
    if (m.lengthFt && m.widthFt) m.sqFt = String(Math.round((Number(m.lengthFt) || 0) * (Number(m.widthFt) || 0) * 100) / 100)
    updateBid(bidId, { measurements: m })
  }

  function toggleBidPhoto(bidId, photoId) {
    const b = bids.find((x) => x.id === bidId)
    if (!b) return
    const cur = b.beforePhotos || []
    updateBid(bidId, { beforePhotos: cur.includes(photoId) ? cur.filter((x) => x !== photoId) : [...cur, photoId] })
  }

  async function analyzePhotos(bid) {
    if (!settings.geminiApiKey) {
      toast('Add your Gemini key in Settings first — photo analysis uses your own key, and the photos are sent to Google\'s Gemini API.')
      return
    }
    const before = (job.photos || []).filter((p) => p.kind === 'before')
    const selected = (bid.beforePhotos || []).length
      ? before.filter((p) => (bid.beforePhotos || []).includes(p.id))
      : before
    if (selected.length === 0) {
      toast('Add before photos to this job first (Photos & Files tab).')
      return
    }
    setAnalyzing(bid.id)
    try {
      const text = await askGeminiVision(settings.geminiApiKey, settings.geminiModel, bidPhotoPrompt(job), selected.slice(0, 4))
      const parsed = extractJson(text)
      updateBid(bid.id, { analysis: { raw: text, parsed: parsed || null, createdAt: nowISO(), photoCount: selected.length } })
      setAnalysisFor(bid.id)
      toast(parsed ? 'Analysis ready — review the draft below, then use it as the estimate.' : 'Analysis came back as text (no structured draft) — read it below and copy what you need.')
    } catch (e) {
      toast('Photo analysis failed: ' + (e.message || e))
    } finally {
      setAnalyzing('')
    }
  }

  function applyParsedDraft(bid, parsed) {
    if (!parsed) { toast('No structured draft to apply — read the text and type the lines in by hand.'); return }
    const patch = {}
    if (parsed.scope) patch.scope = parsed.scope
    if (parsed.laborHours) patch.laborHours = parsed.laborHours
    if (Number(parsed.laborRate) > 0) patch.laborRate = Number(parsed.laborRate)
    if (Number(parsed.other) > 0) patch.other = Number(parsed.other)
    updateBid(bid.id, patch)
    if (Array.isArray(parsed.materials) && parsed.materials.length) {
      onUpdate((d) => {
        const b = (d.bids || []).find((x) => x.id === bid.id)
        if (!b) return
        b.materials = parsed.materials.map((m) => ({ id: uid(), name: String(m.name || 'Item'), qty: Number(m.qty) || 1, unitCost: Number(m.unitCost) || 0, taxable: true }))
      })
    }
    toast('Draft applied to the estimate — review every line before you send it. Nothing is finalized by the AI.')
  }

  function applyAnalysis(bid) {
    applyParsedDraft(bid, bid.analysis && bid.analysis.parsed)
  }

  function applyBidDraft(bid) {
    applyParsedDraft(bid, bid.bidDraft && bid.bidDraft.parsed)
  }

  // Draft a whole bid with Gemini, from the job itself (description,
  // measurements, notes, labor rate and markup) plus the Gemini chat
  // history on this job, when there is one — the chat holds corrections,
  // tenant and phase details the job fields may not. Same draft-only rule
  // as photo analysis: the draft lands on a bid for review, nothing is
  // accepted or final until the carpenter says so.
  async function draftBidWithGemini() {
    if (!settings.geminiApiKey) {
      toast('Add your Gemini key in Settings first — bid drafting uses your own key, and the job details are sent to Google\'s Gemini API.')
      return
    }
    setDrafting(true)
    try {
      const text = await askGemini(settings.geminiApiKey, settings.geminiModel, [{ role: 'user', text: bidDraftPrompt(job, settings, job.aiHistory || []) }])
      const parsed = extractJson(text)
      // Reuse a still-empty bid if one exists, else create a new one.
      const empty = bids.find((b) => (b.materials || []).length === 0 && !Number(b.laborHours) && !Number(b.other) && (!b.scope || b.scope === (job.description || '')))
      let bidId
      if (empty) {
        bidId = empty.id
      } else {
        bidId = uid()
        const validityDays = Number(settings.quoteValidityDays ?? 30) || 0
        const validUntil = validityDays > 0 ? daysFromTodayISO(validityDays) : ''
        const label = `Bid ${bids.length + 1} (Gemini draft)`
        onUpdate((d) => {
          const b = { id: bidId, label, scope: d.description || '', materials: [], labor: 0, other: 0, createdAt: nowISO(), laborRate: Number(settings.defaultLaborRate) || 0, markupPct: Number(settings.defaultMarkupPct ?? 20) || 0, overheadPct: Number(settings.defaultOverheadPct) || 0, validUntil }
          d.bids = [...(d.bids || []), b]
        })
      }
      updateBid(bidId, { bidDraft: { raw: text, parsed: parsed || null, createdAt: nowISO(), source: 'draft' } })
      setDraftFor(bidId)
      toast(parsed ? 'Gemini drafted a bid — review it below, then use it as the estimate.' : 'Gemini answered as text (no structured draft) — read it below and copy what you need.')
    } catch (e) {
      toast('Bid drafting failed: ' + (e.message || e))
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Bids ({bids.length})</h2>
        <p className="muted">A job can have more than one bid — different scope, different price. Every bid is built with the estimate builder below, not a typed amount. Accept one and it drives the job price. The rest stay on record.</p>
        <div className="row">
          <input value={newBidLabel} onChange={(e) => setNewBidLabel(e.target.value)} placeholder="Bid label (e.g. Bid 2 — pine)" />
          <button className="primary" onClick={addBid}>+ Add bid</button>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="small dark" onClick={draftBidWithGemini} disabled={drafting}>
            {drafting ? 'Drafting bid…' : '✨ Draft bid with Gemini'}
          </button>
        </div>
        <p className="muted">Gemini drafts a full bid from this job — description, measurements, notes, your labor rate and markup, and the Gemini chat history on this job when there is one — as editable line items on a new bid. You review every line; nothing is accepted or final.</p>
        {bids.length > 1 && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="small" onClick={() => setShowCompare(!showCompare)}>{showCompare ? 'Hide comparison' : 'Compare bids side by side'}</button>
          </div>
        )}
        {showCompare && bids.length > 1 && (
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="cmp">
              <thead><tr><th></th>{bids.map((b) => <th key={b.id}>{b.label}{job.acceptedBidId === b.id ? ' ✓' : ''}</th>)}</tr></thead>
              <tbody>
                <tr><td><b>Total</b></td>{bids.map((b) => <td key={b.id} className="money">{money(bidTotal(b))}</td>)}</tr>
                <tr><td>Materials</td>{bids.map((b) => <td key={b.id}>{money(bidMaterialsTotal(b))}</td>)}</tr>
                <tr><td>Labor</td>{bids.map((b) => <td key={b.id}>{money(effectiveLabor(b))}</td>)}</tr>
                <tr><td>Other</td>{bids.map((b) => <td key={b.id}>{money(b.other)}</td>)}</tr>
                <tr><td>Overhead</td>{bids.map((b) => <td key={b.id}>{Number(b.overheadPct) || 0}% ({money(bidOverhead(b))})</td>)}</tr>
                <tr><td>Markup</td>{bids.map((b) => <td key={b.id}>{Number(b.markupPct) || 0}% ({money(bidTotal(b) - bidSubtotal(b) - bidOverhead(b))})</td>)}</tr>
                <tr><td>Finish</td>{bids.map((b) => <td key={b.id}>{(FINISH_GRADES.find((g) => g.id === b.finishGrade)?.label || '—') + ' / ' + (FINISHING_BY.find((g) => g.id === b.finishingBy)?.label || '—')}</td>)}</tr>
                <tr><td>Valid until</td>{bids.map((b) => <td key={b.id}>{b.validUntil ? fmtDate(b.validUntil) : '—'}</td>)}</tr>
                <tr><td>Scope</td>{bids.map((b) => <td key={b.id}>{(b.scope || '').slice(0, 120)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {accepted && (
        <div className="card">
          <h2>🛒 Shopping list — from the accepted bid</h2>
          <p className="muted">Everything the accepted bid needs. Check items off as you buy them — the list and the running total stay on the job.</p>
          {(accepted.materials || []).map((m) => {
            const line = (Number(m.qty) || 0) * (Number(m.unitCost) || 0)
            const done = !!checked[m.id]
            return (
              <div key={m.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: done ? 0.55 : 1 }}>
                <span><input type="checkbox" checked={done} onChange={() => onUpdate((d) => { d.shoppingChecked = { ...(d.shoppingChecked || {}), [m.id]: !done } })} style={{ width: 22, height: 22, minHeight: 22, marginRight: 8, verticalAlign: 'middle' }} /><b style={{ textDecoration: done ? 'line-through' : 'none' }}>{m.name}</b> <span className="muted">× {m.qty} @ {money(m.unitCost)}</span></span>
                <span className="money">{money(line)}</span>
              </div>
            )
          })}
          {(accepted.materials || []).length === 0 && <p className="muted">The accepted bid has no material lines yet.</p>}
          {(accepted.materials || []).length > 0 && (
            <p style={{ marginTop: 8 }}>All materials: <b className="money">{money(bidMaterialsTotal(accepted))}</b> • Still to buy: <b className="money">{money((accepted.materials || []).filter((m) => !checked[m.id]).reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0))}</b></p>
          )}
        </div>
      )}
      <div className="card">
        <h2>Quote assemblies</h2>
        <p className="muted">Reusable estimating templates — a door install, baseboard per linear foot, a deck per square foot. Applying one fills the bid's line items (quantities × waste factor, labor hours added). Starter costs are typical planning figures — adjust them to your supplier prices.</p>
        <div className="row wrap">
          <select value={asmId} onChange={(e) => setAsmId(e.target.value)}>
            <option value="">Pick an assembly…</option>
            {(assemblies || []).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.unit}{a.wastePct ? `, ${a.wastePct}% waste` : ''}</option>)}
          </select>
          <input type="number" value={asmQty} onChange={(e) => setAsmQty(e.target.value)} placeholder="Qty" inputMode="decimal" style={{ maxWidth: 90 }} />
          <select value={asmBidId} onChange={(e) => setAsmBidId(e.target.value)}>
            <option value="">To bid…</option>
            {bids.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <button className="small primary" onClick={() => { if (!asmId || !asmBidId || !(Number(asmQty) > 0)) { toast('Pick an assembly, a quantity, and a bid.'); return } applyAssemblyToBid(asmId, asmBidId, asmQty); setAsmQty('') }}>Apply to bid</button>
        </div>
        {(assemblies || []).length > 0 && (
          <div style={{ marginTop: 8 }}>
            {(assemblies || []).map((a) => (
              <p key={a.id} className="muted" style={{ margin: '4px 0' }}>• <b>{a.name}</b> ({a.unit}) — {a.lines.length} lines, {a.laborHours}h labor, {a.wastePct}% waste. {a.note || ''} <button className="small" onClick={() => deleteAssembly(a.id)}>Delete</button></p>
            ))}
          </div>
        )}
        <hr className="hr" />
        <p className="muted">Save a bid you already priced as a reusable assembly:</p>
        <div className="row wrap">
          <select value={saveAsmBidId} onChange={(e) => setSaveAsmBidId(e.target.value)}>
            <option value="">From bid…</option>
            {bids.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <input value={saveAsmName} onChange={(e) => setSaveAsmName(e.target.value)} placeholder="Assembly name" />
          <select value={saveAsmUnit} onChange={(e) => setSaveAsmUnit(e.target.value)}>
            {ASSEMBLY_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <button className="small" onClick={() => { if (!saveAsmBidId || !saveAsmName.trim()) { toast('Pick a bid and a name.'); return } saveAssemblyFromBid(saveAsmBidId, saveAsmName, saveAsmUnit); setSaveAsmName('') }}>Save assembly</button>
        </div>
      </div>
      {bids.map((b) => {
        const before = (job.photos || []).filter((p) => p.kind === 'before')
        const attached = b.beforePhotos || []
        const analysis = b.analysis
        return (
        <div key={b.id} className="card" style={job.acceptedBidId === b.id ? { borderColor: 'var(--ok)', borderWidth: 2 } : {}}>
          <div className="row between">
            <input value={b.label} onChange={(e) => updateBid(b.id, { label: e.target.value })} style={{ fontWeight: 700 }} />
            {job.acceptedBidId === b.id ? <span className="pill done">Accepted</span> : <button className="small primary" onClick={() => acceptBid(b.id)}>Accept this bid</button>}
          </div>
          <label>Scope</label>
          <textarea value={b.scope || ''} onChange={(e) => updateBid(b.id, { scope: e.target.value })} placeholder="What does this bid cover?" />

          <h3 style={{ marginTop: 12 }}>Finish details</h3>
          <p className="muted">Paint grade vs stain grade and who does the finishing are the things that move a price after the quote — name them here so they are in writing.</p>
          <div className="grid2">
            <div><label>Finish grade</label>
              <select value={b.finishGrade || ''} onChange={(e) => updateBid(b.id, { finishGrade: e.target.value })}>
                {FINISH_GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div><label>Who does the finishing?</label>
              <select value={b.finishingBy || ''} onChange={(e) => updateBid(b.id, { finishingBy: e.target.value })}>
                {FINISHING_BY.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: 12 }}>Quote validity</h3>
          <div className="grid2">
            <div><label>Valid until</label><input type="date" value={b.validUntil || ''} onChange={(e) => updateBid(b.id, { validUntil: e.target.value })} /></div>
            <div><p className="muted">Material prices move between quote and build. After this date the price is no longer held.</p></div>
          </div>
          {b.validUntil && b.validUntil < todayISO() && (
            <p style={{ color: 'var(--warn)' }}>⚠️ This quote expired {fmtDate(b.validUntil)} — re-quote before the customer signs. The quote PDF shows the expiry date.</p>
          )}
          {b.validUntil && (
            <div className="row wrap" style={{ marginTop: 6 }}>
              <button className="small" onClick={() => extendQuote(b.id)}>Extend quote by 14 days</button>
              <button className="small" onClick={() => requoteBid(b.id)}>Re-quote as a new draft</button>
              <button className="small" onClick={() => nudgeCustomer(b)}>💬 Nudge customer</button>
            </div>
          )}

          <h3 style={{ marginTop: 12 }}>Measurements</h3>
          <div className="grid2">
            <div><label>Length (ft)</label><input type="number" value={b.measurements?.lengthFt || ''} onChange={(e) => setMeasurements(b.id, { lengthFt: e.target.value })} inputMode="decimal" /></div>
            <div><label>Width (ft)</label><input type="number" value={b.measurements?.widthFt || ''} onChange={(e) => setMeasurements(b.id, { widthFt: e.target.value })} inputMode="decimal" /></div>
            <div><label>Height (ft)</label><input type="number" value={b.measurements?.heightFt || ''} onChange={(e) => setMeasurements(b.id, { heightFt: e.target.value })} inputMode="decimal" /></div>
            <div><label>Linear ft</label><input type="number" value={b.measurements?.linearFt || ''} onChange={(e) => setMeasurements(b.id, { linearFt: e.target.value })} inputMode="decimal" /></div>
          </div>
          <p className="muted">Square feet (auto from length × width): <b>{b.measurements?.sqFt || '—'}</b></p>

          <h3 style={{ marginTop: 12 }}>Before photos — analyze with Gemini</h3>
          <p className="muted">Tap photos to attach them to this bid, then analyze. The photos are sent to Google's Gemini API (your own key) and Gemini drafts scope, materials, and labor hours. You review and adjust every line — it never finalizes on its own.</p>
          {before.length === 0 && <p className="muted">No before photos on this job yet — add them on the Photos &amp; Files tab.</p>}
          <div className="photogrid">
            {before.map((p) => (
              <div key={p.id} onClick={() => toggleBidPhoto(b.id, p.id)} style={{ cursor: 'pointer', border: attached.includes(p.id) ? '3px solid var(--ok)' : '3px solid transparent', borderRadius: 10 }}>
                <img className="thumb" src={p.dataUrl} alt="before" />
                <div className="muted" style={{ textAlign: 'center' }}>{attached.includes(p.id) ? '✓ Attached to this bid' : 'Tap to attach'}</div>
              </div>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button className="small dark" onClick={() => analyzePhotos(b)} disabled={analyzing === b.id}>
              {analyzing === b.id ? 'Analyzing photos…' : '🔍 Analyze photos'}
            </button>
            {analysis && (
              <button className="small" onClick={() => setAnalysisFor(analysisFor === b.id ? '' : b.id)}>
                {analysisFor === b.id ? 'Hide analysis' : 'Show analysis'}
              </button>
            )}
            {b.bidDraft && (
              <button className="small" onClick={() => setDraftFor(draftFor === b.id ? '' : b.id)}>
                {draftFor === b.id ? 'Hide bid draft' : 'Show bid draft'}
              </button>
            )}
          </div>
          {analysis && analysisFor === b.id && (
            <div className="kbd-note" style={{ marginTop: 10 }}>
              <p><b>Gemini draft</b> — from {analysis.photoCount || '?'} photo(s), {fmtDateTime(analysis.createdAt)}. Review everything before using it.</p>
              {analysis.parsed ? (
                <div>
                  {analysis.parsed.scope && <p><b>Scope:</b> {analysis.parsed.scope}</p>}
                  {analysis.parsed.laborHours ? <p><b>Labor hours:</b> {analysis.parsed.laborHours}</p> : null}
                  {Array.isArray(analysis.parsed.materials) && analysis.parsed.materials.length > 0 && (
                    <div>
                      <b>Materials:</b>
                      {analysis.parsed.materials.map((m, i) => <p key={i}>• {m.name} — x{m.qty} @ {money(m.unitCost)}</p>)}
                    </div>
                  )}
                  {analysis.parsed.notes && <p><b>Check on site:</b> {analysis.parsed.notes}</p>}
                  {analysis.parsed.codeIssues && <p><b>Possible code issues:</b> {analysis.parsed.codeIssues}</p>}
                  <button className="small primary" style={{ marginTop: 8 }} onClick={() => applyAnalysis(b)}>Use this draft as the estimate (editable)</button>
                </div>
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{analysis.raw}</p>
              )}
            </div>
          )}
          {b.bidDraft && draftFor === b.id && (
            <div className="kbd-note" style={{ marginTop: 10 }}>
              <p><b>Gemini bid draft</b> — {fmtDateTime(b.bidDraft.createdAt)}. Review everything before using it.</p>
              {b.bidDraft.parsed ? (
                <div>
                  {b.bidDraft.parsed.scope && <p><b>Scope:</b> {b.bidDraft.parsed.scope}</p>}
                  {b.bidDraft.parsed.laborHours ? <p><b>Labor hours:</b> {b.bidDraft.parsed.laborHours}{Number(b.bidDraft.parsed.laborRate) > 0 ? ` @ ${money(b.bidDraft.parsed.laborRate)}/hr` : ''}</p> : null}
                  {Array.isArray(b.bidDraft.parsed.materials) && b.bidDraft.parsed.materials.length > 0 && (
                    <div>
                      <b>Materials:</b>
                      {b.bidDraft.parsed.materials.map((m, i) => <p key={i}>• {m.name} — x{m.qty} @ {money(m.unitCost)}</p>)}
                    </div>
                  )}
                  {Number(b.bidDraft.parsed.other) > 0 && <p><b>Other:</b> {money(b.bidDraft.parsed.other)}</p>}
                  {b.bidDraft.parsed.notes && <p><b>Notes:</b> {b.bidDraft.parsed.notes}</p>}
                  <button className="small primary" style={{ marginTop: 8 }} onClick={() => applyBidDraft(b)}>Use this draft as the estimate (editable)</button>
                </div>
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{b.bidDraft.raw}</p>
              )}
            </div>
          )}

          <h3 style={{ marginTop: 12 }}>Materials</h3>
          {(b.materials || []).map((m) => (
            <div key={m.id} className="row" style={{ marginBottom: 6 }}>
              <input value={m.name} onChange={(e) => updateMaterial(b.id, m.id, { name: e.target.value })} placeholder="Item" style={{ flex: 2 }} />
              <input type="number" value={m.qty} onChange={(e) => updateMaterial(b.id, m.id, { qty: e.target.value })} placeholder="Qty" style={{ flex: 1 }} inputMode="decimal" />
              <input type="number" value={m.unitCost} onChange={(e) => updateMaterial(b.id, m.id, { unitCost: e.target.value })} placeholder="$ each" style={{ flex: 1 }} inputMode="decimal" />
              <label title="Taxable — materials and fabricated custom millwork are taxable; installation labor is not" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12 }}>Tax<input type="checkbox" checked={m.taxable !== false} onChange={(e) => updateMaterial(b.id, m.id, { taxable: e.target.checked })} /></label>
              <button className="small" onClick={() => removeMaterial(b.id, m.id)}>✕</button>
            </div>
          ))}
          <button className="small" onClick={() => addMaterial(b.id)}>+ Add material</button>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <select value={pbId} onChange={(e) => setPbId(e.target.value)} style={{ flex: 2 }}>
              <option value="">From price book…</option>
              {(settings.priceBook || []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.unitPrice !== '' && p.unitPrice != null ? ` — ${money(p.unitPrice)}` : ''}</option>)}
            </select>
            <button className="small" onClick={() => { if (!pbId) { toast('Pick a price-book item first (set them up in Settings).'); return } addMaterialFromPriceBook(b.id, pbId) }}>Add from price book</button>
          </div>
          <p className="muted">The price book lives in Settings — your usual materials and prices, filled in by you.</p>

          <h3 style={{ marginTop: 12 }}>Labor &amp; markup</h3>
          <div className="grid2">
            <div><label>Labor hours</label><input type="number" value={b.laborHours || ''} onChange={(e) => updateBid(b.id, { laborHours: e.target.value })} placeholder="e.g. 12" inputMode="decimal" /></div>
            <div><label>Rate ($/hr)</label><input type="number" value={b.laborRate || ''} onChange={(e) => updateBid(b.id, { laborRate: e.target.value })} placeholder="e.g. 65" inputMode="decimal" /></div>
            <div><label>Other ($)</label><input type="number" value={b.other} onChange={(e) => updateBid(b.id, { other: e.target.value })} inputMode="decimal" /></div>
            <div><label>Overhead (%)</label><input type="number" value={b.overheadPct || ''} onChange={(e) => updateBid(b.id, { overheadPct: e.target.value })} placeholder="e.g. 0" inputMode="decimal" /></div>
            <div><label>Markup (%)</label><input type="number" value={b.markupPct || ''} onChange={(e) => updateBid(b.id, { markupPct: e.target.value })} placeholder="e.g. 20" inputMode="decimal" /></div>
          </div>
          <p className="muted">Labor: {money(effectiveLabor(b))}{Number(b.laborHours) > 0 ? ` (${b.laborHours}h × ${money(b.laborRate)})` : ' (flat amount — enter hours × rate to use the builder)'} • Overhead covers measuring, buying material, admin, insurance, and the van. Markup default is {Number(settings.defaultMarkupPct ?? 20)}% from Settings.</p>
          <p style={{ marginTop: 10 }}>Materials {money(bidMaterialsTotal(b))} + labor {money(effectiveLabor(b))} + other {money(b.other)} = {money(bidSubtotal(b))}{Number(b.overheadPct) > 0 ? ` + overhead ${Number(b.overheadPct)}% (${money(bidOverhead(b))})` : ''}{Number(b.markupPct) > 0 ? ` + markup ${Number(b.markupPct)}% (${money(bidTotal(b) - bidSubtotal(b) - bidOverhead(b))})` : ''} = <b className="money">{money(bidTotal(b))}</b></p>
          {Number(settings.minDayRate) > 0 && bidTotal(b) > 0 && bidTotal(b) < Number(settings.minDayRate) && (
            <p style={{ color: 'var(--warn)' }}>⚠️ Below your minimum day rate of {money(settings.minDayRate)} — setting up saws, dust extraction, and a bench costs the same hour whether the job is one door or ten.</p>
          )}
          <p className="muted">Sales tax ({salesTaxRate(settings).toFixed(2)}% on taxable materials {money(bidTaxableMaterials(b))}): {money(bidTax(b, settings))} — total with tax <b className="money">{money(bidTotalWithTax(b, settings))}</b>. Materials are taxable; installation labor is not. The rate is your Illinois 6.25% state base + the local rate from Settings.</p>
          <div className="row wrap">
            <button className="small" onClick={onPreview}>👁 Preview quote</button>
            <button className="small" onClick={() => makePdf('quote')}>Quote PDF</button>
            <button className="small" onClick={() => sharePdf('quote')}>Share quote</button>
            <button className="small danger" onClick={() => deleteBid(b.id)}>Delete bid</button>
          </div>
        </div>
        )
      })}
      {bids.length === 0 && <p className="muted">No bids yet. Add the first one above.</p>}
    </div>
  )
}

function MoneyTab({ job, fin, bid, addExpense, addPayment, addTool, onUpdate, settings, toast, setInvoice, sendInvoiceReminder, markInvoicePaid, remindMilestone, makePdf, sharePdf, applyPaymentTemplate, updateMilestone, addMilestone, removeMilestone, setBillingType, buildSov, rebuildSov, setSovLine, addSovLine, removeSovLine, createApplication, markApplicationPaid, releaseRetainage, makePayAppPdf, sharePayAppPdf }) {
  const [exLabel, setExLabel] = useState('')
  const [exCat, setExCat] = useState('materials')
  const [exAmt, setExAmt] = useState('')
  const [payLabel, setPayLabel] = useState('')
  const [payKind, setPayKind] = useState('deposit')
  const [payAmt, setPayAmt] = useState('')
  const [toolName, setToolName] = useState('')
  const [toolOwned, setToolOwned] = useState(true)
  const [toolRent, setToolRent] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [appPeriod, setAppPeriod] = useState('')
  const inv = job.invoice || { state: 'unsent' }
  const invState = invoiceState(job)
  const isProgress = job.billingType === 'progress'
  const ps = progressSummary(job, settings)

  async function captureReceipt() {
    try {
      const photo = await Camera.getPhoto({ quality: 60, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt })
      if (!photo || !photo.dataUrl) return
      const base = { photo: photo.dataUrl, vendor: '', amount: '', category: 'materials', label: '', date: todayISO() }
      setReceipt(base)
      if (!settings.geminiApiKey) {
        toast('Receipt photo saved — fill in the amount by hand, or add your Gemini key in Settings to have it read automatically.')
        return
      }
      setReceiptBusy(true)
      try {
        const text = await askGeminiVision(settings.geminiApiKey, settings.geminiModel, receiptPrompt(), [photo.dataUrl])
        const parsed = extractJson(text)
        if (parsed) {
          setReceipt({ ...base, vendor: parsed.vendor || '', amount: parsed.amount ? String(parsed.amount) : '', category: ['materials', 'labor', 'other'].includes(parsed.category) ? parsed.category : 'materials', label: parsed.label || '', date: parsed.date || todayISO() })
          toast('Receipt read — check the numbers before saving.')
        } else {
          toast('Could not read the receipt — fill it in by hand.')
        }
      } catch (e) {
        toast('Receipt read failed: ' + (e.message || e) + ' — fill it in by hand.')
      } finally {
        setReceiptBusy(false)
      }
    } catch (e) {
      toast('Camera unavailable — add the expense by hand below.')
    }
  }

  function saveReceipt() {
    if (!receipt) return
    addExpense(receipt.label || receipt.vendor || 'Receipt', receipt.category, receipt.amount, { vendor: receipt.vendor, photo: receipt.photo, date: receipt.date, receipt: true })
    setReceipt(null)
    toast('Receipt saved as an expense on this job.')
  }

  return (
    <div>
      <div className="card">
        <h2>Billing — {isProgress ? 'Progress billing' : 'Milestones'}</h2>
        <p className="muted">Milestones: a payment schedule template (50/40/10 or 40/40/20). Progress billing: AIA-style — schedule of values, percent complete per line, retainage held back. Builder / commercial jobs usually use progress; homeowner jobs usually use milestones.</p>
        <div className="row">
          <button className={`chip ${!isProgress ? 'on' : ''}`} onClick={() => setBillingType('milestone')}>Milestones</button>
          <button className={`chip ${isProgress ? 'on' : ''}`} onClick={() => setBillingType('progress')}>Progress billing</button>
        </div>
      </div>

      <div className="card">
        <h2>Profit &amp; loss</h2>
        <p>Quoted: <b className="money">{money(fin.quote)}</b> <span className="muted">(accepted bid{fin.changeOrders ? ` + change orders ${money(fin.changeOrders)}` : ''})</span></p>
        <p>Actual costs: materials {money(fin.materials)} + labor {money(fin.labor)} (clocked {money(fin.timeLabor)} over {fmtHours(fin.timeHours)} + manual {money(fin.laborManual)}) + other {money(fin.other)} + tool rentals {money(fin.toolRentals)} = <b className="money">{money(fin.totalCosts)}</b></p>
        <p>Revenue (payments in): <b className="money">{money(fin.revenue)}</b></p>
        {isProgress && <p>Retainage held: <b className="money">{money(ps.retainageHeld)}</b>{ps.released > 0 ? <span className="muted"> • released so far {money(ps.released)}</span> : ''} <span className="muted">({ps.pct}% held back from progress payments until completion)</span></p>}
        <p>Profit / loss: <b className={`money ${fin.profit >= 0 ? 'pos' : 'neg'}`}>{money(fin.profit)}</b></p>
        <p>Balance due from customer: <b className="money">{money(fin.balanceDue)}</b></p>
        {bid && (
          <p className="muted">Sales tax on this job: {money(bidTax(bid, settings))} at {salesTaxRate(settings).toFixed(2)}% (taxable materials {money(bidTaxableMaterials(bid))}) • collected so far (pro-rata from payments): {money(taxCollectedFor(job, settings))}. Tax is shown on the quote and invoice, on top of the bid total.</p>
        )}
        <p className="muted">Quoted vs actual stay separate on purpose — the quote is what you promised, the actuals are what really happened.</p>
      </div>

      {isProgress && (
      <div className="card">
        <h2>Progress billing — schedule of values</h2>
        <p className="muted">Built from the accepted bid: materials broken out, labor, other. Set percent complete per line as the work moves — earned-to-date, previously billed, and this period's amount are computed from it. Pay applications are G702/G703-style templates, not official AIA forms.</p>
        <div className="grid2">
          <div><label>Retainage held back (%)</label><input type="number" value={job.retainagePct ?? ''} onChange={(e) => onUpdate((d) => { d.retainagePct = e.target.value })} placeholder={`${Number(settings.retainagePct ?? 10)}% (Settings default)`} inputMode="decimal" /></div>
          <div><label>Period label for next application</label><input value={appPeriod} onChange={(e) => setAppPeriod(e.target.value)} placeholder="e.g. March 2026" /></div>
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          {(job.scheduleOfValues || []).length === 0
            ? <button className="small primary" onClick={buildSov}>Build schedule of values from accepted bid</button>
            : <button className="small" onClick={rebuildSov}>Rebuild from accepted bid</button>}
          <button className="small" onClick={addSovLine}>+ Add line</button>
        </div>
        {(job.scheduleOfValues || []).length === 0 && <p className="muted" style={{ marginTop: 8 }}>No schedule of values yet — accept a bid, then build it.</p>}
        {(job.scheduleOfValues || []).map((l) => (
          <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <input value={l.description} onChange={(e) => setSovLine(l.id, { description: e.target.value })} placeholder="Line item" style={{ flex: 2 }} />
              <input type="number" value={l.value} onChange={(e) => setSovLine(l.id, { value: e.target.value })} placeholder="$" inputMode="decimal" style={{ flex: 1 }} />
              <input type="number" value={l.pctComplete} onChange={(e) => setSovLine(l.id, { pctComplete: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} placeholder="%" inputMode="decimal" style={{ flex: 1 }} />
              <button className="small" onClick={() => removeSovLine(l.id)}>✕</button>
            </div>
            <p className="muted">{Number(l.pctComplete) || 0}% complete — earned {money((Number(l.value) || 0) * ((Number(l.pctComplete) || 0) / 100))} of {money(l.value)}</p>
          </div>
        ))}
        {(job.scheduleOfValues || []).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p>Scheduled value: <b className="money">{money(ps.total)}</b></p>
            <p>Earned to date: <b className="money">{money(ps.earned)}</b> • Less retainage ({ps.pct}%): <b className="money">{money(ps.retainageHeldToDate)}</b></p>
            <p>Total earned less retainage: <b className="money">{money(ps.lessRetainage)}</b> • Less previous applications: <b className="money">{money(ps.previous)}</b></p>
            <p>Current payment due: <b className="money">{money(ps.currentDue)}</b> • Balance to finish: <b className="money">{money(ps.balance)}</b></p>
            <p>Retainage held: <b className="money">{money(ps.retainageHeld)}</b>{ps.released > 0 ? ` • Released: ${money(ps.released)}` : ''}</p>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="small primary" onClick={() => { createApplication(appPeriod.trim() || undefined); setAppPeriod('') }}>+ New pay application</button>
              {ps.retainageHeld > 0 && <button className="small" onClick={releaseRetainage}>Release retainage ({money(ps.retainageHeld)})</button>}
            </div>
            <p className="muted">Release retainage at completion, with the final walkthrough — it records the held amount as a final payment.</p>
          </div>
        )}
        {(job.progressApplications || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>Pay applications</h3>
            {(job.progressApplications || []).slice().reverse().map((a) => (
              <div key={a.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>#{a.number}</b> — {a.periodLabel} • {fmtDate(a.date)}<br /><span className="muted">Due {money(a.currentDue)} • {a.status === 'paid' ? 'Paid' : 'Submitted'}</span></span>
                <span className="row">
                  <button className="small" onClick={() => makePayAppPdf(a.id)}>Pay app PDF</button>
                  <button className="small" onClick={() => sharePayAppPdf(a.id)}>Share</button>
                  {a.status !== 'paid' && <button className="small primary" onClick={() => markApplicationPaid(a.id)}>Mark paid</button>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {!isProgress && (
      <div className="card">
        <h2>Payment schedule</h2>
        <p className="muted">Two default templates — 50% deposit / 40% at rough-in / 10% at final walkthrough, or 40% / 40% / 20%. Pick one per job; amounts follow the accepted bid — change the bid and the amounts move. Edit the percentages per job.</p>
        {(job.paymentPlan || []).length === 0 && (
          <div className="row wrap">
            {PAYMENT_TEMPLATES.map((t) => (
              <button key={t.id} className="small primary" onClick={() => applyPaymentTemplate(t.id)}>{t.label}</button>
            ))}
          </div>
        )}
        {paymentPlanAmounts(job).map((m) => (
          <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <input value={m.label} onChange={(e) => updateMilestone(m.id, { label: e.target.value })} style={{ flex: 2 }} />
              <input type="number" value={m.pct} onChange={(e) => updateMilestone(m.id, { pct: e.target.value })} inputMode="decimal" style={{ flex: 1 }} aria-label="Percent" />
              <span className="money" style={{ flex: 1, textAlign: 'right' }}>{money(m.amount)}</span>
            </div>
            <div className="row between" style={{ marginTop: 4 }}>
              <span className="muted">{m.due || '—'}</span>
              <span className="row">
                {m.due && m.due < todayISO() && !m.paid && <button className="small" onClick={() => remindMilestone(m)}>💬 Remind</button>}
                <button className={`small ${m.paid ? 'dark' : ''}`} onClick={() => updateMilestone(m.id, { paid: !m.paid })}>{m.paid ? '✓ Paid' : 'Mark paid'}</button>
                <button className="small" onClick={() => removeMilestone(m.id)}>✕</button>
              </span>
            </div>
          </div>
        ))}
        {(job.paymentPlan || []).length > 0 && (
          <div className="row wrap" style={{ marginTop: 8 }}>
            {PAYMENT_TEMPLATES.map((t) => (
              <button key={t.id} className="small" onClick={() => applyPaymentTemplate(t.id)}>Reset to {t.id}</button>
            ))}
            <button className="small" onClick={addMilestone}>+ Add milestone</button>
          </div>
        )}
        <p className="muted">The contract and invoice PDFs print this schedule. Milestones add up to 100% — check the total when you edit them.</p>
      </div>
      )}

      <div className="card">
        <h2>Invoice — {INVOICE_STATES[invState] || invState}</h2>
        <p className="muted">Invoice states: not sent, sent, partially paid, paid, overdue (overdue is automatic once a sent invoice passes its due date). Overdue invoices show on the home screen.</p>
        <div className="grid2">
          <div><label>Invoice state</label>
            <select value={inv.state || 'unsent'} onChange={(e) => setInvoice({ state: e.target.value, sentAt: e.target.value === 'sent' && !inv.sentAt ? nowISO() : inv.sentAt })}>
              {Object.keys(INVOICE_STATES).filter((s) => s !== 'overdue').map((s) => <option key={s} value={s}>{INVOICE_STATES[s]}</option>)}
            </select>
          </div>
          <div><label>Due date</label><input type="date" value={inv.dueDate || ''} onChange={(e) => setInvoice({ dueDate: e.target.value })} /></div>
        </div>
        <p>Balance due: <b className="money">{money(fin.balanceDue)}</b>{inv.sentAt ? <span className="muted"> • sent {fmtDate(inv.sentAt)}</span> : ''}{inv.paidAt ? <span className="muted"> • paid {fmtDate(inv.paidAt)}</span> : ''}</p>
        {invState === 'overdue' && (
          <p style={{ color: 'var(--err)' }}>⛔ This invoice is overdue — balance due {money(fin.balanceDue)}{inv.dueDate ? ` (was due ${fmtDate(inv.dueDate)})` : ''}. Tap Remind customer to draft the text; nothing is sent until you tap send.</p>
        )}
        <div className="row wrap">
          <button className="small primary" onClick={() => makePdf('invoice')}>Invoice PDF</button>
          <button className="small" onClick={() => sharePdf('invoice')}>Share invoice</button>
          {invState !== 'paid' && fin.balanceDue > 0 && <button className="small" onClick={sendInvoiceReminder}>💬 Remind customer</button>}
          {invState !== 'paid' && <button className="small" onClick={markInvoicePaid}>Mark paid</button>}
        </div>
      </div>

      <div className="card">
        <h2>Tools</h2>
        {(job.tools || []).map((t) => (
          <div key={t.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{t.name} — {t.owned ? 'owned' : `rented ${money(t.rentalCost)}`}</span>
            <button className="small" onClick={() => onUpdate((d) => { d.tools = (d.tools || []).filter((x) => x.id !== t.id) })}>✕</button>
          </div>
        ))}
        {(job.tools || []).length === 0 && <p className="muted">No tools listed.</p>}
        <input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="Tool name" style={{ marginTop: 8 }} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className={`chip ${toolOwned ? 'on' : ''}`} onClick={() => setToolOwned(true)}>Owned</button>
          <button className={`chip ${!toolOwned ? 'on' : ''}`} onClick={() => setToolOwned(false)}>Rented</button>
          {!toolOwned && <input type="number" value={toolRent} onChange={(e) => setToolRent(e.target.value)} placeholder="Rental $" inputMode="decimal" />}
        </div>
        <button className="small primary" style={{ marginTop: 8 }} onClick={() => { addTool(toolName, toolOwned, toolRent); setToolName(''); setToolRent('') }}>+ Add tool</button>
      </div>

      <div className="card">
        <h2>Actual expenses</h2>
        <div className="row wrap">
          <button className="small primary" onClick={captureReceipt}>🧾 Photo a receipt</button>
          <span className="muted">Photo a receipt — with your Gemini key set it prefills amount + vendor; otherwise fill it in by hand.</span>
        </div>
        {receipt && (
          <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
            <img className="thumb" src={receipt.photo} alt="receipt" style={{ maxHeight: 220, objectFit: 'contain' }} />
            {receiptBusy && <p className="muted">Reading the receipt…</p>}
            <label>Vendor</label>
            <input value={receipt.vendor} onChange={(e) => setReceipt({ ...receipt, vendor: e.target.value })} placeholder="Store / vendor" />
            <div className="grid2">
              <div><label>Amount ($)</label><input type="number" value={receipt.amount} onChange={(e) => setReceipt({ ...receipt, amount: e.target.value })} inputMode="decimal" /></div>
              <div><label>Date</label><input type="date" value={receipt.date} onChange={(e) => setReceipt({ ...receipt, date: e.target.value })} /></div>
            </div>
            <label>Category</label>
            <select value={receipt.category} onChange={(e) => setReceipt({ ...receipt, category: e.target.value })}>
              <option value="materials">Materials</option>
              <option value="labor">Labor</option>
              <option value="other">Other</option>
            </select>
            <label>Description</label>
            <input value={receipt.label} onChange={(e) => setReceipt({ ...receipt, label: e.target.value })} placeholder="What was it for?" />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="small primary" onClick={saveReceipt} disabled={!receipt.amount}>Save as expense</button>
              <button className="small" onClick={() => setReceipt(null)}>Discard</button>
            </div>
          </div>
        )}
        {(job.expenses || []).map((e) => (
          <div key={e.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{e.receipt ? '🧾 ' : ''}{e.label} <span className="muted">({e.category}, {fmtDate(e.date)}{e.vendor ? `, ${e.vendor}` : ''})</span></span>
            <span className="money">{money(e.amount)}</span>
          </div>
        ))}
        {(job.expenses || []).length === 0 && <p className="muted">No actual expenses recorded yet.</p>}
        <input value={exLabel} onChange={(e) => setExLabel(e.target.value)} placeholder="Expense (e.g. 2x4s from yard)" style={{ marginTop: 8 }} />
        <div className="row" style={{ marginTop: 8 }}>
          <select value={exCat} onChange={(e) => setExCat(e.target.value)}>
            <option value="materials">Materials</option>
            <option value="labor">Labor</option>
            <option value="other">Other</option>
          </select>
          <input type="number" value={exAmt} onChange={(e) => setExAmt(e.target.value)} placeholder="$" inputMode="decimal" />
          <button className="small primary" onClick={() => { addExpense(exLabel, exCat, exAmt); setExLabel(''); setExAmt('') }}>Add</button>
        </div>
      </div>

      <div className="card">
        <h2>Payments received</h2>
        {(job.payments || []).map((p) => (
          <div key={p.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{p.label} <span className="muted">({p.kind}, {fmtDate(p.date)})</span></span>
            <span className="money">{money(p.amount)}</span>
          </div>
        ))}
        {(job.payments || []).length === 0 && <p className="muted">No payments recorded yet.</p>}
        <input value={payLabel} onChange={(e) => setPayLabel(e.target.value)} placeholder="Payment note (e.g. Deposit)" style={{ marginTop: 8 }} />
        <div className="row" style={{ marginTop: 8 }}>
          <select value={payKind} onChange={(e) => setPayKind(e.target.value)}>
            <option value="deposit">Deposit</option>
            <option value="progress">Progress</option>
            <option value="final">Final</option>
            <option value="partial">Partial</option>
          </select>
          <input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="$" inputMode="decimal" />
          <button className="small primary" onClick={() => { addPayment(payLabel, payKind, payAmt); setPayLabel(''); setPayAmt('') }}>Add</button>
        </div>
      </div>
    </div>
  )
}

function PhotosTab({ job, addPhoto, deletePhoto, setViewPhoto, onAttachFile, downloadAttachment, deleteAttachment, attachInputRef, makePdf, sharePdf }) {
  const photos = job.photos || []
  const atts = job.attachments || []
  return (
    <div>
      <div className="card">
        <h2>Photos</h2>
        <div className="row wrap">
          <button className="small primary" onClick={() => addPhoto('before')}>📷 Before photo</button>
          <button className="small primary" onClick={() => addPhoto('after')}>📷 After photo</button>
          <button className="small" onClick={() => addPhoto('general')}>📷 General photo</button>
        </div>
        {photos.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No photos yet. Before/after photos also feed the ad generator.</p>}
        <div className="photogrid" style={{ marginTop: 10 }}>
          {photos.map((p) => (
            <div key={p.id}>
              <img className="thumb" src={p.dataUrl} alt={p.kind} onClick={() => setViewPhoto(p)} />
              <div className="row between"><span className="muted">{p.kind} • {fmtDate(p.createdAt)}</span><button className="small" onClick={() => deletePhoto(p.id)}>✕</button></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Attachments</h2>
        <p className="muted">Contracts, receipts, plans, permits — any file, stored on the device with the job.</p>
        <button className="small primary" onClick={() => attachInputRef.current && attachInputRef.current.click()}>+ Attach a file</button>
        {atts.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No files attached yet.</p>}
        {atts.map((a) => (
          <div key={a.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{a.kind === 'contract' ? '📄' : a.kind === 'receipt' ? '🧾' : a.kind === 'plan' ? '📐' : a.kind === 'permit' ? '🏛️' : '📎'} {a.name} <span className="muted">({a.kind}, {Math.round((a.size || 0) / 1024)} KB)</span></span>
            <span className="row">
              <button className="small" onClick={() => downloadAttachment(a)}>Save</button>
              <button className="small" onClick={() => deleteAttachment(a.id)}>✕</button>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Printouts (PDF)</h2>
        <p className="muted">PDFs save to Downloads and open in the device PDF viewer — printable from there.</p>
        <div className="row wrap">
          <button className="small" onClick={() => makePdf('quote')}>Quote PDF</button>
          <button className="small" onClick={() => makePdf('invoice')}>Invoice PDF</button>
          <button className="small" onClick={() => makePdf('work-order')}>Work order PDF</button>
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => sharePdf('quote')}>Share quote</button>
          <button className="small" onClick={() => sharePdf('invoice')}>Share invoice</button>
          <button className="small" onClick={() => sharePdf('work-order')}>Share work order</button>
        </div>
      </div>
    </div>
  )
}

function TimeTab({ job, onUpdate, clockIn, clockOut, settings, onPreview }) {
  const [worker, setWorker] = useState('Jeramy')
  const open = openTimeEntry(job)
  const totals = jobTimeTotals(job, settings.defaultLaborRate)
  const entries = (job.timeEntries || []).slice().reverse()
  const bid = acceptedBid(job)
  const hc = hoursComparison(job, settings.defaultLaborRate)
  const [hName, setHName] = useState('')
  const [hHours, setHHours] = useState('')
  const [hRate, setHRate] = useState('')
  const [hDate, setHDate] = useState(todayISO())
  const helpers = job.helperHours || []
  const helperHrs = helpers.reduce((s, h) => s + (Number(h.hours) || 0), 0)
  const helperPay = helpers.reduce((s, h) => s + (Number(h.hours) || 0) * (Number(h.rate) || 0), 0)
  return (
    <div>
      <div className="card">
        <h2>Quoted hours vs actual hours</h2>
        {!bid && <p className="muted">No accepted bid yet — quoted hours come from the accepted bid's labor hours.</p>}
        {bid && !hc.quoted && <p className="muted">The accepted bid has no labor hours entered — put hours in the estimate builder and this comparison comes alive.</p>}
        {bid && hc.quoted > 0 && (
          <div>
            <p>Quoted: <b>{fmtHours(hc.quoted)}</b> • Actual clocked: <b>{fmtHours(hc.actual)}</b> • Gap: <b className={hc.diff > 0 ? 'neg' : 'pos'}>{hc.diff > 0 ? '+' : ''}{fmtHours(hc.diff)}</b></p>
            <p className="muted">Quoted vs actual is how the next quote gets better — if actual ran over quoted, raise the hours next time. {hc.diff > 0 ? `This job ran ${fmtHours(hc.diff)} over the quote.` : hc.diff < 0 ? `This job came in ${fmtHours(-hc.diff)} under the quoted hours.` : 'Right on the quote.'}</p>
          </div>
        )}
      </div>
      <div className="card">
        <h2>Clock in / out</h2>
        <p className="muted">Clocked hours feed the job's labor cost automatically at the job's labor rate ({money(jobLaborRate(job, settings.defaultLaborRate))}/hr — set the default in Settings, or the accepted bid's rate wins). One person clocked in at a time per job. Clock in/out stamps your GPS location on the entry (the app asks for location permission) — it proves where the hours were worked and feeds job costing and Reports.</p>
        {open ? (
          <div>
            <p><b>{open.worker}</b> clocked in at {fmtDateTime(open.clockIn)} ({money(open.rate)}/hr).{open.lat != null && open.lng != null ? <span className="muted"> 📍 {open.lat}, {open.lng}</span> : <span className="muted"> Location not recorded.</span>}</p>
            <button className="primary block" onClick={clockOut}>⏱ Clock out</button>
          </div>
        ) : (
          <div>
            <label>Who is clocking in?</label>
            <input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Name (you or a helper)" />
            <button className="primary block" style={{ marginTop: 8 }} onClick={() => clockIn(worker)}>⏱ Clock in</button>
          </div>
        )}
      </div>
      <div className="card">
        <h2>Helper hours</h2>
        <p className="muted">Log a helper's hours here — helper pay feeds the job's actual costs and P&amp;L automatically. Separate from your own clocked hours above.</p>
        <p>Total: <b>{fmtHours(helperHrs)}</b> • Helper pay: <b className="money">{money(helperPay)}</b></p>
        {helpers.map((h) => (
          <div key={h.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span><b>{h.name}</b> — {fmtDate(h.date)} • {fmtHours(h.hours)} × {money(h.rate)} = {money((Number(h.hours) || 0) * (Number(h.rate) || 0))}</span>
            <button className="small" onClick={() => onUpdate((d) => { d.helperHours = (d.helperHours || []).filter((x) => x.id !== h.id) })}>✕</button>
          </div>
        ))}
        {helpers.length === 0 && <p className="muted">No helper hours logged yet.</p>}
        <div className="grid2" style={{ marginTop: 8 }}>
          <div><label>Name</label><input value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Helper name" /></div>
          <div><label>Date</label><input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} /></div>
          <div><label>Hours</label><input type="number" value={hHours} onChange={(e) => setHHours(e.target.value)} placeholder="e.g. 4" inputMode="decimal" /></div>
          <div><label>Rate ($/hr)</label><input type="number" value={hRate} onChange={(e) => setHRate(e.target.value)} placeholder="e.g. 25" inputMode="decimal" /></div>
        </div>
        <button className="small primary" style={{ marginTop: 8 }} onClick={() => { if (!hName.trim() || !(Number(hHours) > 0)) { return } onUpdate((d) => { d.helperHours = [...(d.helperHours || []), { id: uid(), name: hName.trim(), hours: Number(hHours), rate: Number(hRate) || 0, date: hDate || todayISO(), createdAt: nowISO() }] }); setHName(''); setHHours(''); setHRate('') }}>+ Log helper hours</button>
      </div>
      <div className="card">
        <h2>Hours on this job</h2>
        <p>Total: <b>{fmtHours(totals.hours)}</b> • Labor cost from time: <b className="money">{money(totals.labor)}</b></p>
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <button className="small" onClick={onPreview}>👁 Preview timesheet</button>
        </div>
        {Object.keys(totals.byWorker).length > 0 && Object.keys(totals.byWorker).map((w) => (
          <p key={w}>{w}: {fmtHours(totals.byWorker[w])}</p>
        ))}
        {entries.length === 0 && <p className="muted">No time entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span><b>{e.worker}</b> — {fmtDateTime(e.clockIn)} → {e.clockOut ? fmtDateTime(e.clockOut) : 'still in'}<br />
              <span className="muted">{e.clockOut ? `${fmtHours(timeEntryHours(e))} × ${money(e.rate)} = ${money(timeEntryHours(e) * (Number(e.rate) || 0))}` : 'Open entry — not counted yet'}</span>
              <br /><span className="muted">📍 In: {e.lat != null && e.lng != null ? `${e.lat}, ${e.lng}` : 'not recorded'}{e.clockOut ? ` • Out: ${e.clockOutLat != null && e.clockOutLng != null ? `${e.clockOutLat}, ${e.clockOutLng}` : 'not recorded'}` : ''}</span></span>
            <button className="small" onClick={() => onUpdate((d) => { d.timeEntries = (d.timeEntries || []).filter((x) => x.id !== e.id) })}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CloseoutTab({ job, fin, onUpdate, makePdf, sharePdf, recordLienWaiver, settings, toast, onCreateJob }) {
  const [punchText, setPunchText] = useState('')
  const [insDate, setInsDate] = useState('')
  const [insType, setInsType] = useState('Rough inspection')
  const punch = job.punchList || []
  const openPunch = punch.filter((p) => !p.done)
  const permit = job.permit || { number: '', status: 'Not needed', inspectorName: '', inspectorPhone: '' }
  const warranty = job.warranty || { months: 12, startDate: '', expiryDate: '' }
  const maint = job.maintenance || { intervalMonths: 0, nextDueDate: '', notes: '' }
  const waiver = job.lienWaiver || {}
  const exp = warrantyExpiry(job)
  const goodFb = (job.feedback || []).filter((f) => Number(f.stars) >= 4).slice(-1)[0]

  function setPermit(patch) { onUpdate((d) => { d.permit = { ...(d.permit || {}), ...patch } }) }
  function setWarranty(patch) {
    onUpdate((d) => {
      d.warranty = { ...(d.warranty || {}), ...patch }
      const w = d.warranty
      if (w.startDate && Number(w.months) > 0) w.expiryDate = addMonthsISO(w.startDate, w.months)
    })
  }
  function setMaint(patch) { onUpdate((d) => { d.maintenance = { ...(d.maintenance || {}), ...patch } }) }
  function addPunch() {
    if (!punchText.trim()) return
    onUpdate((d) => { d.punchList = [...(d.punchList || []), { id: uid(), text: punchText.trim(), done: false, createdAt: nowISO() }] })
    setPunchText('')
  }
  function addInspection() {
    if (!insDate) { toast('Pick an inspection date first.'); return }
    onUpdate((d) => { d.inspections = [...(d.inspections || []), { id: uid(), date: insDate, type: insType, result: 'scheduled', notes: '' }] })
    setInsDate('')
    toast('Inspection added — it shows on the calendar and a reminder is scheduled the day before.')
  }
  async function shareReviewRequest() {
    if (!settings.googleReviewUrl) { toast('Add your Google review link in Settings first.'); return }
    const text = `Hi ${job.customerName || ''}! Thanks for trusting ${settings.businessName || 'AtotheI Carpentry'} with "${job.title || 'your project'}". If you have a minute, a Google review would mean a lot: ${settings.googleReviewUrl}`
    try { toast(await shareText(text, 'Ask for a review')) } catch (e) { toast(e.message || 'Share failed.') }
  }
  function createMaintenanceJob() {
    if (!onCreateJob) return
    onCreateJob({
      title: `Maintenance: ${job.title || 'previous job'}`,
      customerName: job.customerName,
      phone: job.phone,
      address: job.address,
      description: `Recurring maintenance from "${job.title || 'previous job'}" — ${maint.notes || 'see previous job notes'}.`,
      jobType: job.jobType,
      leadSource: 'Repeat customer',
    })
    toast('New maintenance job created from this one.')
  }

  return (
    <div>
      <div className="card">
        <h2>Punch list — {punch.length - openPunch.length}/{punch.length} done</h2>
        <p className="muted">Finish-items checklist. Must be clear — alongside the code checklist — before the job can be marked Done.</p>
        {punch.length === 0 && <p className="muted">No punch items yet.</p>}
        {punch.map((p) => (
          <div key={p.id} className="checkline">
            <input type="checkbox" checked={p.done} onChange={() => onUpdate((d) => { const x = (d.punchList || []).find((y) => y.id === p.id); if (x) x.done = !x.done })} />
            <div style={{ flex: 1 }}><span style={p.done ? { textDecoration: 'line-through' } : {}}>{p.text}</span></div>
            <button className="small" onClick={() => onUpdate((d) => { d.punchList = (d.punchList || []).filter((x) => x.id !== p.id) })}>✕</button>
          </div>
        ))}
        <input value={punchText} onChange={(e) => setPunchText(e.target.value)} placeholder="Punch item (e.g. Touch up paint on the rail)" style={{ marginTop: 8 }} />
        <button className="small primary" style={{ marginTop: 8 }} onClick={addPunch}>+ Add punch item</button>
      </div>

      <div className="card">
        <h2>Permits &amp; inspections</h2>
        <div className="grid2">
          <div><label>Permit number</label><input value={permit.number || ''} onChange={(e) => setPermit({ number: e.target.value })} placeholder="e.g. 2026-0142" /></div>
          <div><label>Permit status</label>
            <select value={permit.status || 'Not needed'} onChange={(e) => setPermit({ status: e.target.value })}>
              {['Not needed', 'Not applied', 'Applied', 'Approved', 'Issued', 'Closed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label>Inspector name</label><input value={permit.inspectorName || ''} onChange={(e) => setPermit({ inspectorName: e.target.value })} /></div>
          <div><label>Inspector phone</label><input value={permit.inspectorPhone || ''} onChange={(e) => setPermit({ inspectorPhone: e.target.value })} inputMode="tel" /></div>
        </div>
        <h3 style={{ marginTop: 12 }}>Inspections</h3>
        {(job.inspections || []).map((ins) => (
          <div key={ins.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span><b>{ins.type}</b> — {fmtDate(ins.date)}<br /><span className="muted">Result: {ins.result}{ins.notes ? ` • ${ins.notes}` : ''}</span></span>
            <span className="row">
              <select value={ins.result} onChange={(e) => onUpdate((d) => { const x = (d.inspections || []).find((y) => y.id === ins.id); if (x) x.result = e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
              <button className="small" onClick={() => onUpdate((d) => { d.inspections = (d.inspections || []).filter((x) => x.id !== ins.id) })}>✕</button>
            </span>
          </div>
        ))}
        {(job.inspections || []).length === 0 && <p className="muted">No inspections scheduled. Inspection dates show on the calendar.</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <input type="date" value={insDate} onChange={(e) => setInsDate(e.target.value)} />
          <select value={insType} onChange={(e) => setInsType(e.target.value)}>
            <option>Rough inspection</option>
            <option>Final inspection</option>
            <option>Framing inspection</option>
            <option>Electrical inspection</option>
            <option>Other inspection</option>
          </select>
          <button className="small primary" onClick={addInspection}>+ Add</button>
        </div>
      </div>

      <div className="card">
        <h2>Warranty</h2>
        <div className="grid2">
          <div><label>Warranty (months)</label><input type="number" value={warranty.months ?? 12} onChange={(e) => setWarranty({ months: e.target.value })} inputMode="numeric" /></div>
          <div><label>Warranty starts</label><input type="date" value={warranty.startDate || ''} onChange={(e) => setWarranty({ startDate: e.target.value })} /></div>
        </div>
        <p>Expires: <b>{exp ? fmtDate(exp) : '—'}</b>{exp ? <span className="muted"> — a reminder is scheduled 7 days before</span> : ''}</p>
        <p className="muted">Warranty fixes are flagged on the Fixes tab so they never get billed as paid work.</p>
      </div>

      <div className="card">
        <h2>Recurring maintenance</h2>
        <p className="muted">e.g. deck seal every 24 months. When it comes due it shows on the home screen and calendar, and you can turn it into a new bid/job in one tap.</p>
        <div className="grid2">
          <div><label>Interval (months, 0 = none)</label><input type="number" value={maint.intervalMonths || ''} onChange={(e) => setMaint({ intervalMonths: e.target.value })} inputMode="numeric" /></div>
          <div><label>Next due</label><input type="date" value={maint.nextDueDate || ''} onChange={(e) => setMaint({ nextDueDate: e.target.value })} /></div>
        </div>
        <label>What maintenance?</label>
        <input value={maint.notes || ''} onChange={(e) => setMaint({ notes: e.target.value })} placeholder="e.g. Reseal the deck" />
        {maint.nextDueDate && (
          <div className="row" style={{ marginTop: 8 }}>
            <button className="small primary" onClick={createMaintenanceJob}>Create new job from this maintenance</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Lien waiver</h2>
        <p className="muted">Final-payment waiver PDF, marked <b>DRAFT TEMPLATE - NOT LEGAL ADVICE</b>. Generate it once the job is complete and the final payment is in.</p>
        {waiver.generatedAt && <p>Last generated: {fmtDateTime(waiver.generatedAt)} • Final payment covered: {money(waiver.finalPayment)}</p>}
        <div className="row wrap">
          <button className="small primary" onClick={recordLienWaiver}>Set final payment &amp; save</button>
          <button className="small" onClick={() => makePdf('lien-waiver')}>Lien waiver PDF</button>
          <button className="small" onClick={() => sharePdf('lien-waiver')}>Share lien waiver</button>
        </div>
      </div>

      <div className="card">
        <h2>Ask for a Google review</h2>
        {goodFb ? (
          <div>
            <p>{job.customerName || 'The customer'} left {goodFb.stars}★ feedback — a good moment to ask for a public review.</p>
            <button className="small primary" onClick={shareReviewRequest}>Share review request (text)</button>
          </div>
        ) : (
          <p className="muted">After a completed job with good feedback (4★ or better), a one-tap review request shows up here. Set your Google review link in Settings first.</p>
        )}
      </div>
    </div>
  )
}

function FixesTab({ job, onUpdate, addFix }) {
  const [title, setTitle] = useState('')
  const [warranty, setWarranty] = useState(false)
  const fixes = job.fixes || []
  return (
    <div className="card">
      <h2>Fixes / rework</h2>
      <p className="muted">A fix is rework on a finished job — its own record, its own status. Feedback concerns land here automatically. Warranty fixes are flagged separately and never billed.</p>
      {fixes.length === 0 && <p className="muted">No fixes on this job.</p>}
      {fixes.map((f) => (
        <div key={f.id} className="checkline">
          <input type="checkbox" checked={f.status === 'done'} onChange={() => onUpdate((d) => { const x = (d.fixes || []).find((y) => y.id === f.id); if (x) { x.status = x.status === 'done' ? 'open' : 'done'; x.doneAt = x.status === 'done' ? nowISO() : '' } })} />
          <div style={{ flex: 1 }}>
            <b style={f.status === 'done' ? { textDecoration: 'line-through' } : {}}>{f.title}</b>
            {f.warranty && <span className="pill done" style={{ marginLeft: 6 }}>Warranty</span>}
            {f.description && <div className="muted">{f.description}</div>}
            <div className="muted">{fmtDate(f.createdAt)}{f.doneAt ? ` • done ${fmtDate(f.doneAt)}` : ''}</div>
          </div>
          <span className={`pill ${f.status === 'done' ? 'done' : 'open'}`}>{f.status}</span>
        </div>
      ))}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs fixing?" style={{ marginTop: 10 }} />
      <div className="checkline">
        <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} />
        <div><b>Warranty fix</b><div className="muted">Covered by the job warranty — not billed.</div></div>
      </div>
      <button className="small primary" style={{ marginTop: 8 }} onClick={() => { addFix(title, warranty); setTitle(''); setWarranty(false) }}>+ Add fix</button>
    </div>
  )
}

function FollowUpsTab({ job, onUpdate, addFollowUp }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const list = job.followUps || []
  return (
    <div className="card">
      <h2>Follow-ups</h2>
      <p className="muted">Check-ins, warranty calls, "how is it holding up" — with a due date. Overdue ones show on the home screen.</p>
      {list.length === 0 && <p className="muted">No follow-ups on this job.</p>}
      {list.map((f) => (
        <div key={f.id} className="checkline">
          <input type="checkbox" checked={f.done} onChange={() => onUpdate((d) => { const x = (d.followUps || []).find((y) => y.id === f.id); if (x) { x.done = !x.done; x.doneAt = x.done ? nowISO() : '' } })} />
          <div style={{ flex: 1 }}>
            <b style={f.done ? { textDecoration: 'line-through' } : {}}>{f.title}</b>
            <div className="muted">{f.dueDate ? `Due ${fmtDate(f.dueDate)}` : 'No due date'}{!f.done && f.dueDate && f.dueDate < todayISO() ? ' • OVERDUE' : ''}</div>
          </div>
          {!f.done && f.dueDate && f.dueDate < todayISO() && <span className="pill overdue">Overdue</span>}
        </div>
      ))}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow-up (e.g. Call to check the stairs)" style={{ marginTop: 10 }} />
      <div className="row" style={{ marginTop: 8 }}>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="small primary" onClick={() => { addFollowUp(title, due); setTitle(''); setDue('') }}>+ Add follow-up</button>
      </div>
    </div>
  )
}

function CodeTab({ job, onUpdate, toggleChecklist, rebuildChecklist }) {
  const linked = job.codeSections || []
  const list = job.codeChecklist || []
  const doneCount = list.filter((c) => c.checked || c.na).length
  return (
    <div>
      <div className="card">
        <h2>Code checklist — {doneCount}/{list.length} done</h2>
        <p className="muted">The numbers that apply to this job type. All items must be checked (or marked N/A) before the job can be marked Done.</p>
        <label>Code sections linked to this job</label>
        <div className="chips">
          {CODE_SECTIONS.map((s) => {
            const on = linked.includes(s.id)
            return (
              <button key={s.id} className={`chip ${on ? 'on' : ''}`} onClick={() => onUpdate((d) => {
                d.codeSections = on ? (d.codeSections || []).filter((x) => x !== s.id) : [...(d.codeSections || []), s.id]
                d.codeChecklist = checklistForJob(d)
              })}>{s.title}</button>
            )
          })}
        </div>
        <button className="small" onClick={rebuildChecklist}>Rebuild checklist from linked sections</button>
      </div>
      <div className="card">
        {list.length === 0 && <p className="muted">No checklist items — link a code section above, or change the job type on the Overview tab.</p>}
        {list.map((c) => (
          <div key={c.id} className="checkline">
            <input type="checkbox" checked={c.checked} onChange={() => toggleChecklist(c.id, 'checked')} />
            <div style={{ flex: 1 }}>
              <span style={c.checked ? { textDecoration: 'line-through' } : {}}>{c.label}</span>
              <div className="muted">{c.cite}</div>
            </div>
            <button className={`small ${c.na ? 'dark' : ''}`} onClick={() => toggleChecklist(c.id, 'na')}>N/A</button>
          </div>
        ))}
      </div>
      <p className="muted">Reference only, not legal advice. The local jurisdiction and the inspector on the job have the final say.</p>
    </div>
  )
}

function ContractTab({ job, bid, fin, makePdf, sharePdf, onPreview, recordContractAcceptance, saveChangeOrder, deleteChangeOrder, signChangeOrder, updateHrra, recordHrraAck, settings, toast }) {
  const c = job.contract || { changeOrders: [] }
  const hrra = job.hrra || { pamphletAck: {}, arbitration: {}, juryWaiver: {}, estimatedCompletionDate: '' }
  const hrraAmountValue = hrraAmount(job, bidTotal)
  const hrraOn = hrraAmountValue > HRRA_THRESHOLD
  const acked = hrraAcknowledged(job)
  const [ackName, setAckName] = useState('')
  const [showCoForm, setShowCoForm] = useState(false)
  const [coTitle, setCoTitle] = useState('')
  const [coDesc, setCoDesc] = useState('')
  const [coMaterials, setCoMaterials] = useState([])
  const [coLaborHours, setCoLaborHours] = useState('')
  const [coLaborRate, setCoLaborRate] = useState('')
  const [coPhoto, setCoPhoto] = useState('')
  const coPhotoInputRef = useRef(null)
  const coMatTotal = coMaterials.reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0)
  const coLaborTotal = (Number(coLaborHours) || 0) * (Number(coLaborRate) || jobLaborRate(job, settings.defaultLaborRate))
  const coTotal = Math.round((coMatTotal + coLaborTotal) * 100) / 100
  async function attachCoPhoto() {
    try {
      const photo = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt })
      if (photo && photo.dataUrl) setCoPhoto(photo.dataUrl)
    } catch (e) {
      if (coPhotoInputRef.current) coPhotoInputRef.current.click()
    }
  }
  function onCoPhotoFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => { setCoPhoto(String(r.result)); toast('Photo attached to the change order.') }
    r.readAsDataURL(file)
    e.target.value = ''
  }
  function saveCo() {
    if (!coTitle.trim()) { toast('Give the change order a title first.'); return }
    saveChangeOrder({ title: coTitle.trim(), description: coDesc.trim(), materials: coMaterials, laborHours: Number(coLaborHours) || 0, laborRate: Number(coLaborRate) || jobLaborRate(job, settings.defaultLaborRate), price: coTotal, photo: coPhoto })
    setShowCoForm(false); setCoTitle(''); setCoDesc(''); setCoMaterials([]); setCoLaborHours(''); setCoLaborRate(''); setCoPhoto('')
  }
  return (
    <div>
      <div className="card">
        <h2>Illinois HRRA — Home Repair and Remodeling Act</h2>
        <p className="muted">For residential jobs over $1,000, Illinois law requires a written contract and the Illinois Attorney General's pamphlet "{HRRA_PAMPHLET_NAME}". Jobs $1,000 and under skip this gate.</p>
        <p>Job amount: <b className="money">{money(hrraAmountValue)}</b> — {hrraOn ? <b>HRRA applies (over $1,000)</b> : 'under $1,000 — the HRRA acknowledgment is not required for this job.'}</p>
        {hrraOn && !acked && <p style={{ color: 'var(--err)' }}>⛔ This job cannot move to Scheduled or In Progress until the customer acknowledges the pamphlet below. That is a hard gate, like the code checklist.</p>}
        {hrraOn && acked && <p style={{ color: 'var(--ok)' }}>✓ Pamphlet acknowledged by {hrra.pamphletAck.signedBy} on {fmtDate(hrra.pamphletAck.signedAt)} — the HRRA gate is open.</p>}
        <h3 style={{ marginTop: 10 }}>What the pamphlet covers</h3>
        <ul className="muted">
          {HRRA_PAMPHLET_SUMMARY.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
        {hrraOn && !acked && (
          <div>
            <label>Customer typed name — acknowledgment that they received the pamphlet</label>
            <input value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="Customer name (typed signature)" />
            <button className="small primary" style={{ marginTop: 8 }} onClick={() => { if (!ackName.trim()) { toast('Type the customer name first.'); return } recordHrraAck(ackName) }}>Record pamphlet acknowledgment</button>
          </div>
        )}
        <h3 style={{ marginTop: 12 }}>Arbitration &amp; jury trial — separate initial boxes</h3>
        <p className="muted">The homeowner accepts or rejects each one separately, with initials and a date. These print on the contract PDF.</p>
        <div className="grid2">
          <div>
            <label>Binding arbitration</label>
            <div className="row">
              <button className={`chip ${hrra.arbitration?.choice === 'accept' ? 'on' : ''}`} onClick={() => updateHrra({ arbitration: { ...(hrra.arbitration || {}), choice: 'accept' } })}>Accept</button>
              <button className={`chip ${hrra.arbitration?.choice === 'reject' ? 'on' : ''}`} onClick={() => updateHrra({ arbitration: { ...(hrra.arbitration || {}), choice: 'reject' } })}>Reject</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <input value={hrra.arbitration?.initials || ''} onChange={(e) => updateHrra({ arbitration: { ...(hrra.arbitration || {}), initials: e.target.value } })} placeholder="Initials" style={{ maxWidth: 90 }} />
              <input type="date" value={hrra.arbitration?.date || ''} onChange={(e) => updateHrra({ arbitration: { ...(hrra.arbitration || {}), date: e.target.value } })} />
            </div>
          </div>
          <div>
            <label>Jury trial waiver</label>
            <div className="row">
              <button className={`chip ${hrra.juryWaiver?.choice === 'accept' ? 'on' : ''}`} onClick={() => updateHrra({ juryWaiver: { ...(hrra.juryWaiver || {}), choice: 'accept' } })}>Accept</button>
              <button className={`chip ${hrra.juryWaiver?.choice === 'reject' ? 'on' : ''}`} onClick={() => updateHrra({ juryWaiver: { ...(hrra.juryWaiver || {}), choice: 'reject' } })}>Reject</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <input value={hrra.juryWaiver?.initials || ''} onChange={(e) => updateHrra({ juryWaiver: { ...(hrra.juryWaiver || {}), initials: e.target.value } })} placeholder="Initials" style={{ maxWidth: 90 }} />
              <input type="date" value={hrra.juryWaiver?.date || ''} onChange={(e) => updateHrra({ juryWaiver: { ...(hrra.juryWaiver || {}), date: e.target.value } })} />
            </div>
          </div>
        </div>
        <h3 style={{ marginTop: 12 }}>Contract dates &amp; address</h3>
        <div className="grid2">
          <div><label>Start date</label><p>Set on the Overview tab: <b>{job.scheduledDate ? fmtDate(job.scheduledDate) : 'not set yet'}</b></p></div>
          <div><label>Estimated completion date</label><input type="date" value={hrra.estimatedCompletionDate || ''} onChange={(e) => updateHrra({ estimatedCompletionDate: e.target.value })} /></div>
        </div>
        {settings.businessAddress
          ? <p className="muted">Business address on the contract: {settings.businessAddress}</p>
          : <p style={{ color: 'var(--warn)' }}>⚠️ Add your physical business address in Settings — HRRA requires it on the contract, and it must not be a P.O. Box.</p>}
      </div>
      <div className="card">
        <h2>Contract</h2>
        <p className="muted">Plain-English draft generated from the accepted bid. Every page is marked <b>DRAFT TEMPLATE - NOT LEGAL ADVICE</b> — have a local attorney review it before use.</p>
        {bid ? (
          <p>Contract price: <b className="money">{money(fin.quote)}</b> (accepted bid{fin.changeOrders ? ` + change orders ${money(fin.changeOrders)}` : ''})</p>
        ) : (
          <p className="muted">Accept a bid first — the contract is built from it.</p>
        )}
        {bid && (bid.finishGrade || bid.finishingBy) && (
          <p>Finish: <b>{FINISH_GRADES.find((g) => g.id === bid.finishGrade)?.label || 'Not specified'}</b> • Finishing by: <b>{FINISHING_BY.find((g) => g.id === bid.finishingBy)?.label || 'Not specified'}</b> — these are written into the contract.</p>
        )}
        <div className="row wrap">
          <button className="small" onClick={onPreview}>👁 Preview contract</button>
          <button className="small primary" onClick={() => makePdf('contract')}>Contract PDF</button>
          <button className="small" onClick={() => sharePdf('contract')}>Share contract</button>
          <button className="small" onClick={recordContractAcceptance}>Record customer acceptance</button>
        </div>
        {c.signedAt && <p style={{ marginTop: 8 }}>✓ Accepted by {c.signedBy} on {fmtDate(c.signedAt)}{c.acceptedInApp ? ' (in app)' : ''}</p>}
      </div>
      <div className="card">
        <h2>Change orders</h2>
        <p className="muted">Amendments to the job — priced (extra labor + materials), photo attached, and signed by the customer BEFORE the extra work starts. An unsigned change order is "not approved, do not start".</p>
        {(c.changeOrders || []).length === 0 && <p className="muted">No change orders.</p>}
        {(c.changeOrders || []).map((co) => (
          <div key={co.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row between">
              <span><b>{co.title}</b> — {money(co.price)}{co.description ? <span className="muted"> — {co.description}</span> : ''}</span>
              <span>{co.signedAt ? <span className="pill done">Approved</span> : <span className="pill lost">⚠️ Not approved — do not start</span>}</span>
            </div>
            <p className="muted">{co.signedAt ? `Signed by ${co.signedBy} on ${fmtDate(co.signedAt)}` : 'Unsigned — the customer has not signed this yet.'}{(co.laborHours ? ` • Labor ${co.laborHours}h` : '')}{(co.materials && co.materials.length ? ` • Materials: ${co.materials.map((m) => `${m.name} x${m.qty}`).join(', ')}` : '')}</p>
            {co.photo && <img className="thumb" src={co.photo} alt="change order" style={{ maxWidth: 200 }} />}
            <div className="row wrap" style={{ marginTop: 6 }}>
              {!co.signedAt && <button className="small primary" onClick={() => signChangeOrder(co.id)}>Customer sign</button>}
              <button className="small danger" onClick={() => deleteChangeOrder(co.id)}>Delete</button>
            </div>
          </div>
        ))}
        {!showCoForm && <button className="small primary" style={{ marginTop: 8 }} onClick={() => setShowCoForm(true)}>+ Add change order</button>}
        {showCoForm && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <label>Title</label>
            <input value={coTitle} onChange={(e) => setCoTitle(e.target.value)} placeholder="e.g. Add a second shelf row" />
            <label>What changes?</label>
            <textarea value={coDesc} onChange={(e) => setCoDesc(e.target.value)} placeholder="Describe the extra work" />
            <h3 style={{ marginTop: 10 }}>Extra materials</h3>
            {coMaterials.map((m) => (
              <div key={m.id} className="row" style={{ marginBottom: 6 }}>
                <input value={m.name} onChange={(e) => setCoMaterials(coMaterials.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x))} placeholder="Item" style={{ flex: 2 }} />
                <input type="number" value={m.qty} onChange={(e) => setCoMaterials(coMaterials.map((x) => x.id === m.id ? { ...x, qty: e.target.value } : x))} placeholder="Qty" style={{ flex: 1 }} inputMode="decimal" />
                <input type="number" value={m.unitCost} onChange={(e) => setCoMaterials(coMaterials.map((x) => x.id === m.id ? { ...x, unitCost: e.target.value } : x))} placeholder="$ each" style={{ flex: 1 }} inputMode="decimal" />
                <button className="small" onClick={() => setCoMaterials(coMaterials.filter((x) => x.id !== m.id))}>✕</button>
              </div>
            ))}
            <button className="small" onClick={() => setCoMaterials([...coMaterials, { id: uid(), name: '', qty: 1, unitCost: 0 }])}>+ Add material</button>
            <div className="grid2" style={{ marginTop: 8 }}>
              <div><label>Extra labor hours</label><input type="number" value={coLaborHours} onChange={(e) => setCoLaborHours(e.target.value)} placeholder="e.g. 3" inputMode="decimal" /></div>
              <div><label>Rate ($/hr)</label><input type="number" value={coLaborRate} onChange={(e) => setCoLaborRate(e.target.value)} placeholder={`${jobLaborRate(job, settings.defaultLaborRate)} (job rate)`} inputMode="decimal" /></div>
            </div>
            <p>Materials {money(coMatTotal)} + labor {money(coLaborTotal)} = <b className="money">{money(coTotal)}</b></p>
            <div className="row wrap">
              <button className="small" onClick={attachCoPhoto}>📷 Attach photo</button>
              {coPhoto && <span className="muted">Photo attached ✓ <button className="small" onClick={() => setCoPhoto('')}>Remove</button></span>}
            </div>
            {coPhoto && <img className="thumb" src={coPhoto} alt="change order" style={{ maxWidth: 200, marginTop: 6 }} />}
            <input ref={coPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onCoPhotoFile} />
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button className="small primary" onClick={saveCo}>Save change order</button>
              <button className="small" onClick={() => setShowCoForm(false)}>Cancel</button>
            </div>
            <p className="muted">Saved unsigned — the customer signs it (typed name + date) before the extra work starts.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackTab({ job, fb, setFb, fbKind, setFbKind, saveFeedback, feedbackPdf }) {
  function set(k, v) { setFb((p) => ({ ...p, [k]: v })) }
  const list = job.feedback || []
  return (
    <div>
      <div className="card">
        <h2>Customer feedback</h2>
        <p className="muted">Hand the phone to the customer. Two moments: a mid-job check-in, and a completion form when the work is done. Concerns automatically become a fix task; improvements become a follow-up.</p>
        <div className="row">
          <button className={`chip ${fbKind === 'mid-job' ? 'on' : ''}`} onClick={() => setFbKind('mid-job')}>Mid-job check-in</button>
          <button className={`chip ${fbKind === 'completion' ? 'on' : ''}`} onClick={() => setFbKind('completion')}>Completion</button>
        </div>
        <label>Customer name</label>
        <input value={fb.customerName} onChange={(e) => set('customerName', e.target.value)} />
        <label>Overall satisfaction</label>
        <Stars value={fb.stars} onChange={(n) => set('stars', n)} />
        <div className="grid2">
          <div><label>Quality (1–5)</label><input type="number" min="1" max="5" value={fb.quality} onChange={(e) => set('quality', e.target.value)} /></div>
          <div><label>Timeliness (1–5)</label><input type="number" min="1" max="5" value={fb.timeliness} onChange={(e) => set('timeliness', e.target.value)} /></div>
          <div><label>Communication (1–5)</label><input type="number" min="1" max="5" value={fb.communication} onChange={(e) => set('communication', e.target.value)} /></div>
          <div><label>Cleanliness (1–5)</label><input type="number" min="1" max="5" value={fb.cleanliness} onChange={(e) => set('cleanliness', e.target.value)} /></div>
        </div>
        <label>Concerns or issues</label>
        <textarea value={fb.concerns} onChange={(e) => set('concerns', e.target.value)} placeholder="Anything wrong? This becomes a fix task." />
        <label>What could be improved</label>
        <textarea value={fb.improvements} onChange={(e) => set('improvements', e.target.value)} placeholder="This becomes a follow-up task." />
        <label>Your words about the job (testimonial)</label>
        <textarea value={fb.testimonial} onChange={(e) => set('testimonial', e.target.value)} placeholder="What would you tell a neighbor?" />
        <div className="checkline">
          <input type="checkbox" checked={fb.consent} onChange={(e) => set('consent', e.target.checked)} />
          <div><b>May I use your words in my ads?</b><div className="muted">Only "yes" answers are ever used in ad drafts.</div></div>
        </div>
        <button className="primary block" style={{ marginTop: 10 }} onClick={saveFeedback}>Save feedback</button>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => feedbackPdf(null)}>Blank paper form (PDF)</button>
        </div>
      </div>
      <div className="card">
        <h2>Past feedback ({list.length})</h2>
        {list.length === 0 && <p className="muted">None yet.</p>}
        {list.slice().reverse().map((f) => (
          <div key={f.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <p><b>{'★'.repeat(Number(f.stars))}{'☆'.repeat(5 - Number(f.stars))}</b> — {f.kind === 'mid-job' ? 'Mid-job' : 'Completion'} • {fmtDate(f.createdAt)} • {f.customerName}</p>
            {f.testimonial && <p>"{f.testimonial}" {f.consent ? <span className="pill done">OK for ads</span> : <span className="pill lost">Not for ads</span>}</p>}
            {f.concerns && <p className="muted">Concern: {f.concerns}</p>}
            {f.improvements && <p className="muted">Improve: {f.improvements}</p>}
            <button className="small" onClick={() => feedbackPdf(f)}>Export as PDF</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdsTab({ job, adText, setAdText, buildAd, shareAd, shareAdWithPhotos, copyAd, approvedTestimonials }) {
  const allFb = job.feedback || []
  return (
    <div>
      <div className="card">
        <h2>Ad from this job</h2>
        <p className="muted">Built from the finished job — scope, before/after photos, and only testimonials the customer said yes to. Check it before you post.</p>
        <button className="primary block" onClick={buildAd}>Build ad draft</button>
        <label style={{ marginTop: 12 }}>Ad caption</label>
        <textarea value={adText} onChange={(e) => setAdText(e.target.value)} style={{ minHeight: 160 }} />
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="small primary" onClick={shareAd}>Share text</button>
          <button className="small" onClick={shareAdWithPhotos}>Share with photos</button>
          <button className="small" onClick={copyAd}>Copy text</button>
        </div>
        <p className="muted">Paid ads are not in v1 — this makes a post-ready draft for Facebook. Paid boosting is a follow-up decision.</p>
      </div>
      <div className="card">
        <h2>Testimonials approved for ads</h2>
        {approvedTestimonials.length === 0 && <p className="muted">None yet — only feedback with "May I use your words in my ads? — Yes" shows up here.</p>}
        {approvedTestimonials.map((f) => (
          <p key={f.id}>"{f.testimonial}" — {String(f.customerName || job.customerName || 'Customer').split(' ')[0]}</p>
        ))}
        {allFb.filter((f) => !f.consent && (f.testimonial || '').trim()).length > 0 && (
          <p className="muted">{allFb.filter((f) => !f.consent && (f.testimonial || '').trim()).length} testimonial(s) held back — customer said no. They never appear in ad drafts.</p>
        )}
      </div>
    </div>
  )
}
