// Carpentry Jobs — local-first store. All data lives on the device in
// localStorage. No account, no backend, no network calls except Gemini
// (user's own key) when the user asks for AI help or photo analysis.
const KEY = 'carpentry-jobs-v1'

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function todayISO() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function nowISO() {
  return new Date().toISOString()
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function money(n) {
  const v = Number(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function slugify(s) {
  return String(s || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'job'
}

export function fileStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

export function addMonthsISO(iso, months) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d)) return ''
  d.setMonth(d.getMonth() + (Number(months) || 0))
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  if (isNaN(da) || isNaN(db)) return null
  return Math.round((db - da) / 86400000)
}

export function fmtHours(h) {
  const v = Number(h) || 0
  return (Math.round(v * 10) / 10) + 'h'
}

export const STATUS_LABELS = {
  enquiry: 'Enquiry',
  bid: 'Bid',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  done: 'Done',
  'follow-up': 'Follow-up',
  lost: 'Bid Lost',
  cancelled: 'Cancelled',
}

export const JOB_TYPES = [
  { id: 'general', label: 'General carpentry' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'deck', label: 'Deck' },
  { id: 'framing', label: 'Framing' },
  { id: 'trim', label: 'Trim / finish' },
  { id: 'repair', label: 'Repair' },
]

export const LEAD_SOURCES = ['Facebook ad', 'Referral', 'Repeat customer', 'Google', 'Other']

// Who is paying: homeowner direct, or a builder / designer / property
// manager sending work. Builder work pays less per hour than direct —
// reports split by this so the difference is visible.
export const CUSTOMER_TYPES = [
  { id: 'homeowner', label: 'Homeowner' },
  { id: 'builder', label: 'Builder / contractor' },
  { id: 'designer', label: 'Designer / architect' },
  { id: 'property-manager', label: 'Property manager / landlord' },
]

export const FINISH_GRADES = [
  { id: '', label: 'Not specified' },
  { id: 'paint', label: 'Paint grade' },
  { id: 'stain', label: 'Stain grade' },
]

export const FINISHING_BY = [
  { id: '', label: 'Not specified' },
  { id: 'me', label: 'Me (contractor)' },
  { id: 'customer', label: 'Customer' },
  { id: 'other-trade', label: 'Other trade' },
]

export const INVOICE_STATES = {
  unsent: 'Not sent',
  sent: 'Sent',
  partial: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
}

export const PERMIT_STATES = ['Not needed', 'Not applied', 'Applied', 'Approved', 'Issued', 'Closed']

// ---- Customer code system (generic, reusable pattern) ----
// A short public code per job + a public JSON lookup with NO private data.
// Same pattern can be reused for future ideas: code -> public facts only.
// A code is NOT a password — anyone who guesses a code sees only the
// first name, job type, and status. Never put address, phone, money,
// notes, or photos in the public feed.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function genJobCode(taken) {
  const takenSet = new Set(taken || [])
  for (let tries = 0; tries < 200; tries++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    if (!takenSet.has(code)) return code
  }
  return 'X' + Math.random().toString(36).slice(2, 7).toUpperCase()
}

export function publicStatusFeed(store) {
  return {
    app: 'carpentry-jobs',
    updatedAt: nowISO(),
    feedbackFormUrl: (store.settings && store.settings.feedbackFormUrl) || '',
    jobs: (store.jobs || [])
      .filter((j) => j.jobCode)
      .map((j) => ({
        code: j.jobCode,
        firstName: String(j.customerName || 'Customer').split(' ')[0],
        jobType: j.jobType || 'general',
        status: j.status || 'bid',
      })),
  }
}

// ---- Customers (directory, derived from jobs) ----
// A customer is keyed by phone digits when there is one, else by the
// lowercased name. Lead source / notes live in store.customers[key].
export function customerKey(job) {
  const digits = String(job.phone || '').replace(/\D/g, '')
  if (digits.length >= 7) return 'p:' + digits.slice(-10)
  return 'n:' + String(job.customerName || 'unknown').trim().toLowerCase()
}

export function customerGroups(store) {
  const map = new Map()
  for (const j of store.jobs || []) {
    const key = customerKey(j)
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: j.customerName || 'Unknown',
        phone: j.phone || '',
        address: j.address || '',
        jobs: [],
      })
    }
    const g = map.get(key)
    g.jobs.push(j)
    if (!g.phone && j.phone) g.phone = j.phone
    if (!g.address && j.address) g.address = j.address
  }
  const meta = store.customers || {}
  return [...map.values()].map((g) => {
    const won = g.jobs.filter((j) => j.outcome === 'completed' || j.status === 'done').length
    const lost = g.jobs.filter((j) => j.outcome === 'lost' || j.status === 'lost').length
    const revenue = g.jobs.reduce((s, j) => s + jobActuals(j).revenue, 0)
    const m = meta[g.key] || {}
    const fromJobs = [...g.jobs].reverse().find((j) => j.customerType)?.customerType || ''
    return {
      ...g,
      customerType: m.customerType || fromJobs,
      leadSource: m.leadSource || '',
      notes: m.notes || '',
      won, lost,
      winRate: (won + lost) ? Math.round((won / (won + lost)) * 100) : null,
      revenue,
      repeat: g.jobs.length > 1,
    }
  }).sort((a, b) => b.revenue - a.revenue)
}

export function overallWinRate(store) {
  const jobs = store.jobs || []
  const won = jobs.filter((j) => j.outcome === 'completed' || j.status === 'done').length
  const lost = jobs.filter((j) => j.outcome === 'lost' || j.status === 'lost').length
  return { won, lost, rate: (won + lost) ? Math.round((won / (won + lost)) * 100) : null }
}

// ---- Jobs ----

export function newJob(takenCodes) {
  const t = nowISO()
  return {
    id: uid(),
    jobCode: genJobCode(takenCodes),
    title: '',
    customerName: '',
    phone: '',
    address: '',
    description: '',
    jobType: 'general',
    customerType: '',
    status: 'bid',
    outcome: null,
    createdAt: t,
    updatedAt: t,
    scheduledDate: '',
    startedDate: '',
    finishedDate: '',
    leadSource: '',
    bids: [],
    acceptedBidId: null,
    tools: [],
    expenses: [],
    payments: [],
    notes: [],
    photos: [],
    attachments: [],
    fixes: [],
    followUps: [],
    codeSections: [],
    codeChecklist: [],
    // Estimate measurements live on each bid (see newBid). Job-level
    // measurements are the overall site measurements for reference.
    measurements: { lengthFt: '', widthFt: '', heightFt: '', sqFt: '', linearFt: '' },
    timeEntries: [],
    invoice: { state: 'unsent', dueDate: '', sentAt: '', paidAt: '' },
    lienWaiver: { generatedAt: '', finalPayment: 0, signedAt: '', signedBy: '' },
    punchList: [],
    permit: { number: '', status: 'Not needed', inspectorName: '', inspectorPhone: '' },
    inspections: [],
    warranty: { months: 12, startDate: '', expiryDate: '' },
    maintenance: { intervalMonths: 0, nextDueDate: '', notes: '' },
    // Payment plan: milestones { id, label, pct, due, paid }. Amounts are
    // computed live from the quote — the plan is percentages, not dollars,
    // so it stays right when the bid changes. Default template is 50/40/10.
    paymentPlan: [],
    // Billing: 'milestone' (50/40/10 schedule) or 'progress' (AIA-style).
    // Progress billing uses the schedule of values + pay applications.
    billingType: 'milestone',
    scheduleOfValues: [],
    progressApplications: [],
    retainagePct: '',
    retainageReleased: 0,
    // Illinois HRRA (Home Repair and Remodeling Act). Pamphlet
    // acknowledgment is a hard gate for residential jobs over $1,000.
    hrra: {
      pamphletAck: { signedBy: '', signedAt: '' },
      arbitration: { choice: '', initials: '', date: '' },
      juryWaiver: { choice: '', initials: '', date: '' },
      estimatedCompletionDate: '',
    },
    contract: { signedAt: '', signedBy: '', acceptedInApp: false, changeOrders: [] },
    aiHistory: [],
    adDraft: null,
  }
}

export function newBid() {
  return {
    id: uid(),
    label: 'Bid 1',
    scope: '',
    materials: [],
    labor: 0,
    // Estimate builder fields — every bid is built with these, not a
    // typed amount. laborHours x laborRate wins over the flat labor
    // field when hours are entered (flat labor stays as fallback).
    measurements: { lengthFt: '', widthFt: '', heightFt: '', sqFt: '', linearFt: '' },
    laborHours: 0,
    laborRate: 0,
    markupPct: 0,
    overheadPct: 0,
    // Finish details — the things that move a price after the quote:
    // paint grade vs stain grade, and who does the finishing.
    finishGrade: '',
    finishingBy: '',
    // Quote validity — a date after which the price is no longer held
    // (material prices move between quote and build).
    validUntil: '',
    beforePhotos: [],
    analysis: null,
    createdAt: nowISO(),
  }
}

// ---- Payment schedule templates ----
// Two defaults: 50/40/10 (deposit / rough-in / final) and 40/40/20
// (deposit / rough-in / completion). Pick per job; the milestone plan on
// the job stays editable after it is applied.
export const PAYMENT_TEMPLATES = [
  {
    id: '50-40-10', label: '50/40/10 — deposit / rough-in / final', milestones: [
      { label: 'Deposit — on signing', pct: 50, due: 'On signing' },
      { label: 'Progress — rough-in / delivery', pct: 40, due: 'Rough-in / delivery' },
      { label: 'Final — on completion / walkthrough', pct: 10, due: 'Final walkthrough' },
    ],
  },
  {
    id: '40-40-20', label: '40/40/20 — deposit / rough-in / completion', milestones: [
      { label: 'Deposit — on signing', pct: 40, due: 'On signing' },
      { label: 'Progress — rough-in / delivery', pct: 40, due: 'Rough-in / delivery' },
      { label: 'Final — on completion / walkthrough', pct: 20, due: 'Final walkthrough' },
    ],
  },
]

export function paymentPlanFromTemplate(templateId) {
  const t = PAYMENT_TEMPLATES.find((x) => x.id === templateId) || PAYMENT_TEMPLATES[0]
  return t.milestones.map((m) => ({ id: uid(), label: m.label, pct: m.pct, due: m.due, paid: false }))
}

// Default payment schedule: 50% deposit on signing, 40% at rough-in /
// delivery, 10% at final walkthrough. Applied as the default payment plan
// when a bid is accepted; editable per job after that.
export function defaultPaymentPlan() {
  return paymentPlanFromTemplate('50-40-10')
}

export function paymentPlanAmounts(job) {
  const quote = quotedAmount(job)
  return (job.paymentPlan || []).map((m) => ({
    ...m,
    amount: Math.round(quote * ((Number(m.pct) || 0) / 100) * 100) / 100,
  }))
}

// ---- Quote assemblies (reusable estimating templates) ----
// An assembly bundles lumber (board-foot / linear-foot calc), consumables,
// and a waste-factor % into one reusable template. Applying it to a bid
// fills the bid's line items. Starter set below — unit costs are TYPICAL
// planning figures; adjust them to your supplier prices, and save your own
// assemblies from bids you have already priced.
export function defaultAssemblies() {
  return [
    {
      id: 'door-interior', name: 'Interior door install', unit: 'each',
      note: 'Per door, pre-hung. Typical costs — adjust to your supplier.',
      wastePct: 5, laborHours: 2.5,
      lines: [
        { name: 'Pre-hung interior door', qty: 1, unitCost: 85, taxable: true },
        { name: 'Casing set', qty: 1, unitCost: 28, taxable: true },
        { name: 'Shims', qty: 1, unitCost: 4, taxable: true },
        { name: 'Screws & fasteners', qty: 1, unitCost: 6, taxable: true },
        { name: 'Wood glue', qty: 1, unitCost: 5, taxable: true },
      ],
    },
    {
      id: 'baseboard-lf', name: 'Baseboard', unit: 'per linear ft',
      note: 'Per linear foot, paint grade. Typical costs — adjust to your supplier.',
      wastePct: 10, laborHours: 0.12,
      lines: [
        { name: 'Baseboard (per LF)', qty: 1, unitCost: 2.1, taxable: true },
        { name: 'Caulk (per LF)', qty: 1, unitCost: 0.35, taxable: true },
        { name: 'Nails / fasteners (per LF)', qty: 1, unitCost: 0.15, taxable: true },
      ],
    },
    {
      id: 'deck-sqft', name: 'Deck', unit: 'per sq ft',
      note: 'Per square foot, pressure-treated. Typical costs — adjust to your supplier.',
      wastePct: 10, laborHours: 0.35,
      lines: [
        { name: 'Decking boards (per sq ft)', qty: 1, unitCost: 4.5, taxable: true },
        { name: 'Framing lumber (per sq ft)', qty: 1, unitCost: 2.8, taxable: true },
        { name: 'Fasteners (per sq ft)', qty: 1, unitCost: 0.6, taxable: true },
        { name: 'Concrete / footings (per sq ft)', qty: 1, unitCost: 1.2, taxable: true },
      ],
    },
  ]
}

export const ASSEMBLY_UNITS = [
  { id: 'each', label: 'each' },
  { id: 'per linear ft', label: 'per linear ft' },
  { id: 'per sq ft', label: 'per sq ft' },
]

// Apply an assembly to a bid: material quantities are multiplied by the
// quantity and the waste factor, labor hours are added. Returns the patch
// to merge into the bid (materials appended, labor hours added, and the
// measurement set when the assembly is priced per sq ft / linear ft).
export function applyAssembly(bid, assembly, qty) {
  const q = Number(qty) || 0
  const waste = 1 + ((Number(assembly.wastePct) || 0) / 100)
  const r2 = (v) => Math.round(v * 100) / 100
  const materials = (assembly.lines || []).map((l) => ({
    id: uid(), name: l.name, qty: r2((Number(l.qty) || 0) * q * waste),
    unitCost: Number(l.unitCost) || 0, taxable: l.taxable !== false,
  }))
  const patch = {
    materials: [...(bid.materials || []), ...materials],
    laborHours: (Number(bid.laborHours) || 0) + (Number(assembly.laborHours) || 0) * q,
  }
  const measurements = { ...(bid.measurements || {}) }
  if (assembly.unit === 'per sq ft') measurements.sqFt = String(q)
  if (assembly.unit === 'per linear ft') measurements.linearFt = String(q)
  patch.measurements = measurements
  return patch
}

// Quoted hours (accepted bid) vs actual clocked hours. The gap is how the
// next quote gets better — if actual ran over quoted, raise the hours.
export function hoursComparison(job, defaultRate) {
  const bid = acceptedBid(job)
  const quoted = bid ? (Number(bid.laborHours) || 0) : 0
  const actual = jobTimeTotals(job, defaultRate).hours
  return { quoted, actual, diff: actual - quoted }
}

export function bidMaterialsTotal(bid) {
  return (bid.materials || []).reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0)
}

// Effective labor: hours x rate when hours are entered, else flat labor.
export function effectiveLabor(bid) {
  if (!bid) return 0
  const h = Number(bid.laborHours) || 0
  if (h > 0) return h * (Number(bid.laborRate) || 0)
  return Number(bid.labor) || 0
}

export function bidSubtotal(bid) {
  if (!bid) return 0
  return bidMaterialsTotal(bid) + effectiveLabor(bid) + (Number(bid.other) || 0)
}

// Overhead covers the unpaid hours (measuring, buying material, admin),
// insurance, and the van. It is charged on the subtotal, then markup is
// charged on subtotal + overhead. With overhead 0 the total is unchanged
// from v1, so old bids are not re-priced by this change.
export function bidOverhead(bid) {
  if (!bid) return 0
  return bidSubtotal(bid) * ((Number(bid.overheadPct) || 0) / 100)
}

export function bidTotal(bid) {
  if (!bid) return 0
  const base = bidSubtotal(bid) + bidOverhead(bid)
  const markup = base * ((Number(bid.markupPct) || 0) / 100)
  return base + markup
}

export function acceptedBid(job) {
  return (job.bids || []).find((b) => b.id === job.acceptedBidId) || null
}

export function quotedAmount(job) {
  const b = acceptedBid(job)
  return b ? bidTotal(b) : 0
}

// ---- Illinois sales tax ----
// Materials sold to the customer are taxable; installation labor is not.
// Each material line is marked taxable or not (fabricated custom millwork
// is taxable, like materials). The rate is the Illinois 6.25% state base
// plus the local rate the user enters for their municipality — the app
// does NOT look rates up (no backend). Tax is shown separately from the
// bid total on quotes and invoices.
export function salesTaxRate(settings) {
  return (Number(settings?.taxStateRate ?? 6.25) || 0) + (Number(settings?.taxLocalRate) || 0)
}

export function bidTaxableMaterials(bid) {
  if (!bid) return 0
  return (bid.materials || [])
    .filter((m) => m.taxable !== false)
    .reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0)
}

export function bidTax(bid, settings) {
  if (!bid) return 0
  return bidTaxableMaterials(bid) * (salesTaxRate(settings) / 100)
}

export function bidTotalWithTax(bid, settings) {
  if (!bid) return 0
  return bidTotal(bid) + bidTax(bid, settings)
}

// Sales tax collected on a job, estimated pro-rata from payments received:
// the tax share of what the customer has actually paid so far.
export function taxCollectedFor(job, settings) {
  const bid = acceptedBid(job)
  if (!bid) return 0
  const quote = bidTotal(bid)
  if (quote <= 0) return 0
  const fin = jobActuals(job)
  return fin.revenue * (bidTax(bid, settings) / quote)
}
// Each entry: { id, worker, clockIn, clockOut, rate, note }.
// Clocked hours feed labor cost into the P&L automatically at the
// entry's rate (or the job's labor rate / default rate when blank).
export function jobLaborRate(job, defaultRate) {
  const b = acceptedBid(job)
  if (b && Number(b.laborRate) > 0) return Number(b.laborRate)
  return Number(defaultRate) || 65
}

export function timeEntryHours(e) {
  if (!e || !e.clockIn || !e.clockOut) return 0
  const ms = new Date(e.clockOut) - new Date(e.clockIn)
  if (isNaN(ms) || ms <= 0) return 0
  return ms / 3600000
}

export function jobTimeTotals(job, defaultRate) {
  const rate = jobLaborRate(job, defaultRate)
  let hours = 0
  let labor = 0
  const byWorker = {}
  for (const e of job.timeEntries || []) {
    const h = timeEntryHours(e)
    const r = Number(e.rate) || rate
    hours += h
    labor += h * r
    byWorker[e.worker || 'Me'] = (byWorker[e.worker || 'Me'] || 0) + h
  }
  return { hours, labor, byWorker }
}

export function openTimeEntry(job) {
  return (job.timeEntries || []).find((e) => e.clockIn && !e.clockOut) || null
}

// Actual costs: expenses by category + rented-tool costs + clocked time.
export function jobActuals(job, defaultRate) {
  const ex = job.expenses || []
  const materials = ex.filter((e) => e.category === 'materials').reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const laborManual = ex.filter((e) => e.category === 'labor').reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const other = ex.filter((e) => e.category === 'other').reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const toolRentals = (job.tools || []).filter((t) => !t.owned).reduce((s, t) => s + (Number(t.rentalCost) || 0), 0)
  const time = jobTimeTotals(job, defaultRate)
  const labor = laborManual + time.labor
  const changeOrders = (job.contract?.changeOrders || []).reduce((s, c) => s + (Number(c.price) || 0), 0)
  const totalCosts = materials + labor + other + toolRentals
  const revenue = (job.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const quote = quotedAmount(job) + changeOrders
  return {
    materials, labor, laborManual, timeHours: time.hours, timeLabor: time.labor,
    other, toolRentals, changeOrders,
    totalCosts, revenue, quote,
    profit: revenue - totalCosts,
    balanceDue: Math.max(0, quote - revenue),
  }
}

// ---- Invoices ----
// Stored state is unsent/sent/partial/paid. "Overdue" is derived:
// sent or partial past its due date reads as overdue.
export function invoiceState(job) {
  const inv = job.invoice || { state: 'unsent' }
  if (inv.state === 'paid') return 'paid'
  if ((inv.state === 'sent' || inv.state === 'partial') && inv.dueDate && inv.dueDate < todayISO()) return 'overdue'
  return inv.state || 'unsent'
}

export function overdueInvoices(store) {
  const out = []
  for (const j of store.jobs || []) {
    if (invoiceState(j) === 'overdue') out.push({ job: j, inv: j.invoice || {} })
  }
  return out
}

// ---- Progress billing (AIA-style, G702/G703 pattern) ----
// Schedule of values: the accepted bid's lines broken out — one line per
// material, one for labor, one for other (when > 0). Each line carries
// its percent complete. Earned-to-date, previously billed, this period,
// and retainage follow the G702 shape. The pay application PDF is a
// TEMPLATE — not an official AIA form, not legal advice.
export function buildScheduleOfValues(job) {
  const bid = acceptedBid(job)
  if (!bid) return []
  const lines = []
  for (const m of bid.materials || []) {
    lines.push({ id: uid(), description: `${m.name} (x${m.qty})`, value: (Number(m.qty) || 0) * (Number(m.unitCost) || 0), pctComplete: 0 })
  }
  const labor = effectiveLabor(bid)
  if (labor > 0) lines.push({ id: uid(), description: 'Labor', value: labor, pctComplete: 0 })
  const other = Number(bid.other) || 0
  if (other > 0) lines.push({ id: uid(), description: 'Other', value: other, pctComplete: 0 })
  return lines
}

export function sovTotal(job) {
  return (job.scheduleOfValues || []).reduce((s, l) => s + (Number(l.value) || 0), 0)
}

export function sovEarned(job) {
  return (job.scheduleOfValues || []).reduce((s, l) => s + (Number(l.value) || 0) * ((Number(l.pctComplete) || 0) / 100), 0)
}

// Retainage % for this job: an explicit per-job value wins (including 0
// = no retainage); blank means "use the Settings default".
export function retainagePctFor(job, settings) {
  if (job.retainagePct !== '' && job.retainagePct !== null && job.retainagePct !== undefined) return Number(job.retainagePct) || 0
  return Number(settings?.retainagePct ?? 10) || 0
}

export function progressSummary(job, settings) {
  const total = sovTotal(job)
  const earned = sovEarned(job)
  const pct = retainagePctFor(job, settings)
  const retainageHeldToDate = earned * (pct / 100)
  const released = Number(job.retainageReleased) || 0
  const retainageHeld = Math.max(0, retainageHeldToDate - released)
  const lessRetainage = earned - retainageHeldToDate
  const previous = (job.progressApplications || []).reduce((s, a) => s + (Number(a.lessRetainage) || 0), 0)
  const currentDue = lessRetainage - previous
  const balance = total - earned
  return { total, earned, pct, retainageHeldToDate, retainageHeld, released, lessRetainage, previous, currentDue, balance }
}

export function newProgressApplication(job, settings, periodLabel) {
  const s = progressSummary(job, settings)
  const n = (job.progressApplications || []).length + 1
  const r2 = (v) => Math.round(v * 100) / 100
  return {
    id: uid(),
    number: n,
    periodLabel: periodLabel || `Application ${n}`,
    date: todayISO(),
    earnedToDate: r2(s.earned),
    retainagePct: s.pct,
    retainageHeld: r2(s.retainageHeldToDate),
    lessRetainage: r2(s.lessRetainage),
    previousCertificates: r2(s.previous),
    currentDue: r2(s.currentDue),
    balanceToFinish: r2(s.balance),
    status: 'submitted',
  }
}

// ---- Warranty / maintenance ----

export function warrantyExpiry(job) {
  const w = job.warranty || {}
  if (w.expiryDate) return w.expiryDate
  if (w.startDate && Number(w.months) > 0) return addMonthsISO(w.startDate, w.months)
  return ''
}

export function warrantyExpiringSoon(store, withinDays) {
  const out = []
  const today = todayISO()
  for (const j of store.jobs || []) {
    const exp = warrantyExpiry(j)
    if (!exp) continue
    const d = daysBetween(today, exp)
    if (d !== null && d >= 0 && d <= (withinDays || 30)) out.push({ job: j, expiry: exp, daysLeft: d })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

export function maintenanceDue(store) {
  const out = []
  const today = todayISO()
  for (const j of store.jobs || []) {
    const m = j.maintenance || {}
    if (m.nextDueDate && m.nextDueDate <= today) out.push({ job: j, due: m.nextDueDate })
  }
  return out.sort((a, b) => String(a.due).localeCompare(String(b.due)))
}

export function punchListDone(job) {
  const list = job.punchList || []
  return list.every((p) => p.done)
}

export function jobCodeChecklistDone(job) {
  const list = job.codeChecklist || []
  if (list.length === 0) return true
  return list.every((c) => c.checked || c.na)
}

export function overdueFollowUps(job) {
  const t = todayISO()
  return (job.followUps || []).filter((f) => !f.done && f.dueDate && f.dueDate < t)
}

// ---- Reports ----
// Cash basis: revenue from payment dates, costs from expense dates.
export function computeReports(store, period) {
  // period: { type: 'month'|'quarter', start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  const jobs = store.jobs || []
  const inRange = (iso) => iso && iso >= period.start && iso <= period.end
  let revenue = 0, costs = 0
  const byType = {}
  const byCustomer = {}
  for (const j of jobs) {
    for (const p of j.payments || []) if (inRange(p.date)) revenue += Number(p.amount) || 0
    for (const e of j.expenses || []) if (inRange(e.date)) costs += Number(e.amount) || 0
    const fin = jobActuals(j)
    for (const e of j.timeEntries || []) {
      const d = (e.clockIn || '').slice(0, 10)
      if (inRange(d)) costs += timeEntryHours(e) * (Number(e.rate) || jobLaborRate(j, store.settings?.defaultLaborRate))
    }
    if (j.finishedDate && inRange(j.finishedDate)) {
      byType[j.jobType || 'general'] = (byType[j.jobType || 'general'] || 0) + 1
      const key = customerKey(j)
      byCustomer[key] = byCustomer[key] || { name: j.customerName || 'Unknown', revenue: 0, jobs: 0 }
      byCustomer[key].revenue += fin.revenue
      byCustomer[key].jobs += 1
    }
  }
  const finished = jobs.filter((j) => j.finishedDate && inRange(j.finishedDate))
  const completedRevenue = finished.reduce((s, j) => s + jobActuals(j).revenue, 0)
  const win = overallWinRate(store)
  // Revenue / jobs / win rate split by customer type. Win/lost counts are
  // all-time per type; finished jobs and revenue are this period.
  const byCustomerType = {}
  const typeLabel = (t) => (CUSTOMER_TYPES.find((x) => x.id === t)?.label) || (t ? t : 'Not set')
  for (const j of jobs) {
    const t = j.customerType || ''
    byCustomerType[t] = byCustomerType[t] || { type: t, label: typeLabel(t), finished: 0, revenue: 0, won: 0, lost: 0 }
    if (j.outcome === 'completed' || j.status === 'done') byCustomerType[t].won += 1
    if (j.outcome === 'lost' || j.status === 'lost') byCustomerType[t].lost += 1
  }
  for (const j of finished) {
    const t = j.customerType || ''
    byCustomerType[t].finished += 1
    byCustomerType[t].revenue += jobActuals(j).revenue
  }
  for (const t of Object.values(byCustomerType)) {
    t.winRate = (t.won + t.lost) ? Math.round((t.won / (t.won + t.lost)) * 100) : null
  }
  // Quoted hours vs actual clocked hours on jobs finished in this period.
  // The gap is how the next quote gets better.
  let hoursQuoted = 0, hoursActual = 0
  for (const j of finished) {
    const hc = hoursComparison(j, store.settings?.defaultLaborRate)
    hoursQuoted += hc.quoted
    hoursActual += hc.actual
  }
  // Illinois sales tax: tax due on accepted bids for jobs finished in this
  // period, and tax collected (pro-rata from payments received).
  let taxDue = 0, taxCollected = 0
  for (const j of finished) {
    const bid = acceptedBid(j)
    if (!bid) continue
    taxDue += bidTax(bid, store.settings)
    taxCollected += taxCollectedFor(j, store.settings)
  }
  return {
    revenue, costs, profit: revenue - costs,
    jobsFinished: finished.length,
    avgJobValue: finished.length ? completedRevenue / finished.length : 0,
    byType,
    byCustomerType: Object.values(byCustomerType).sort((a, b) => b.revenue - a.revenue),
    hoursSummary: { quoted: hoursQuoted, actual: hoursActual, diff: hoursActual - hoursQuoted },
    taxSummary: { due: taxDue, collected: taxCollected },
    topCustomers: Object.values(byCustomer).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    winRate: win,
  }
}

export function monthPeriod(offset) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + (offset || 0))
  const start = d.toISOString().slice(0, 10)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { type: 'month', start, end, label }
}

export function quarterPeriod(offset) {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + (offset || 0)
  const year = now.getFullYear() + Math.floor(q / 4)
  const qq = ((q % 4) + 4) % 4
  const start = new Date(year, qq * 3, 1).toISOString().slice(0, 10)
  const end = new Date(year, qq * 3 + 3, 0).toISOString().slice(0, 10)
  return { type: 'quarter', start, end, label: `Q${qq + 1} ${year}` }
}

// ---- Business plan: blueprint checklist, budgets, milestones ----
// The Startup-to-Finish blueprint as a trackable checklist, merged with
// the compliance/setup paperwork — one Business screen, not two.
// Checklist, not legal advice — confirm licensing, insurance, and tax
// items with your local licensing office and an accountant.
// Illinois note: general carpentry and remodeling are regulated at the
// city/county level here, not by a state license; roofing and plumbing
// have state licenses.
export function defaultBlueprint() {
  const item = (id, label, detail, hasExpiry) => ({ id, label, detail, done: false, doneAt: '', expiryDate: '', hasExpiry: !!hasExpiry })
  return [
    {
      id: 'phase1', title: 'Phase 1 — Foundation & Legal', items: [
        item('niche', 'Choose a niche', 'Finish/trim, custom cabinetry & built-ins, framing, or remodeling — the tools, customers, and quotes are different businesses.'),
        item('llc', 'Register the business — LLC + business name', 'Form an LLC to protect personal assets; register the business name with the state.'),
        item('ein', 'EIN from the IRS', 'Free from irs.gov — needed for the business bank account and taxes.'),
        item('licensing', 'Verify licensing & bonding', 'Illinois: general carpentry is regulated at the city/county level, not by a state license. Roofing and plumbing have state licenses. Check your city/county rules.'),
        item('gl-insurance', 'General liability insurance — $1M/$2M', 'Builders will not put you on a job without a certificate.', true),
        item('auto-insurance', 'Commercial auto insurance', 'For the work truck / van.', true),
        item('inland-marine', 'Inland marine — tools coverage', 'Protects your tools from theft, on the job and in the truck.', true),
      ],
    },
    {
      id: 'phase2', title: 'Phase 2 — Tools, Shop & Financial', items: [
        item('bank', 'Business bank account', 'Dedicated checking; separate personal and business expenses from day one.'),
        item('equipment', 'Core equipment', 'Reliable work vehicle, miter saw, table saw, track saw, drills, nailers, dust extraction. Buy the work, not the shop, first.'),
        item('pricing', 'Pricing & markup set', 'Hourly rate covering wages, overhead, insurance, and profit — not just take-home pay. 15–30% markup on materials. Set the defaults in Settings → Pricing.'),
      ],
    },
    {
      id: 'phase3', title: 'Phase 3 — Branding & First Clients', items: [
        item('gbp', 'Google Business Profile', 'Free listing with photos of your best past work; ask early clients for reviews.'),
        item('portfolio', 'Simple portfolio', 'One-page website or social showcase with clear before/after photos of trim, cabinets, or framing.'),
        item('networking', 'Network with trades', 'Introduce yourself to local GCs, custom home builders, interior designers, and realtors who need reliable subs.'),
      ],
    },
    {
      id: 'phase4', title: 'Phase 4 — Operations & Scaling', items: [
        item('contracts', 'Standardized contracts & estimates', 'Written proposals: exact scope, material allowances, 50/40/10 payment schedule, change-order rules. The app generates them.'),
        item('job-costing', 'Track job costing', 'Compare estimated hours and material costs against actuals after every project — quoted vs actual in Reports.'),
        item('hire', 'Hire & systematize', 'Once booked out 6–8 weeks, bring on an apprentice/helper for prep, sanding, and cleanup.'),
      ],
    },
  ]
}

// Editable budget tables. Amounts are TYPICAL / PLANNING figures from
// published carpentry business-plan ranges — not his actual spending.
// He replaces them with his real numbers. The vehicle row has NO amount:
// a running work vehicle is the gating item — fix one or buy used —
// and any price would be invented.
export function defaultBudget() {
  return {
    startup: [
      { id: 'vehicle', label: 'Work vehicle (used) + racks / trailer', amount: '', note: 'GATING ITEM — fix a current vehicle or buy used. Price depends on what you find; no number is filled in.' },
      { id: 'tools', label: 'Tools & equipment (beyond what you own)', amount: 7500, note: 'Typical' },
      { id: 'gl-first', label: 'General liability insurance (first year)', amount: 1200, note: 'Typical' },
      { id: 'licensing', label: 'Licensing / registration', amount: 750, note: 'Typical' },
      { id: 'bond', label: 'Contractor surety bond (first year, where required)', amount: 500, note: 'Typical' },
      { id: 'llc-ein', label: 'Business registration, LLC & EIN', amount: 268, note: 'Typical' },
      { id: 'website', label: 'Website & Google Business Profile', amount: 0, note: 'Free to set up' },
      { id: 'software', label: 'Estimating / invoicing / job software (first year)', amount: 0, note: 'This app — $0' },
      { id: 'signage', label: 'Van lettering, job signage, business cards', amount: 850, note: 'Typical' },
      { id: 'ppe', label: 'Dust extraction, PPE, first-aid kit', amount: 600, note: 'Typical' },
      { id: 'capital', label: 'Working capital (first two months)', amount: 6500, note: 'Typical' },
    ],
    monthly: [
      { id: 'materials', label: 'Lumber, sheet goods, hardware, finishes', amount: 1500, note: 'Typical $1,500–$8,000/mo — billed to jobs, paid up front' },
      { id: 'vehicle-costs', label: 'Fuel, vehicle, commercial auto insurance, maintenance', amount: 400, note: 'Typical $400–$1,400/mo' },
      { id: 'insurance-monthly', label: 'General liability, workers comp once you hire', amount: 60, note: 'Typical $60–$350/mo' },
      { id: 'consumables', label: 'Blades, bits, abrasives, fasteners, tool replacement', amount: 100, note: 'Typical $100–$500/mo' },
      { id: 'marketing', label: 'Marketing and lead services', amount: 100, note: 'Typical $100–$600/mo' },
      { id: 'admin', label: 'Phone, internet, bookkeeping, permits', amount: 100, note: 'Typical $100–$450/mo' },
      { id: 'rent', label: 'Shop or bay rent', amount: 0, note: 'Typical $0–$1,200/mo' },
      { id: 'helper', label: 'Helper / second carpenter (once you hire)', amount: 0, note: 'Typical $0–$5,000/mo' },
    ],
  }
}

export function defaultMilestones() {
  const m = (id, horizon, label) => ({ id, horizon, label, done: false, doneAt: '' })
  return [
    m('m30-1', '30', 'Decide your specialty — finish/trim, cabinetry, framing, or remodeling'),
    m('m30-2', '30', 'Look up Illinois + city/county contractor rules; start license / registration'),
    m('m30-3', '30', 'Business bank account opened'),
    m('m30-4', '30', 'Google Business Profile live with photos'),
    m('m30-5', '30', 'First quotes built with the estimate builder'),
    m('m60-1', '60', 'First 3 jobs completed with before/after photos'),
    m('m60-2', '60', 'First Google reviews in'),
    m('m60-3', '60', 'Pricing defaults set from real job costs'),
    m('m60-4', '60', 'Portfolio page / social showcase started'),
    m('m90-1', '90', 'A month of work booked ahead'),
    m('m90-2', '90', '2–3 builder / designer contacts sending work'),
    m('m90-3', '90', 'Quoted-vs-actual hours reviewed; rates adjusted'),
  ]
}

export function businessProgress(store) {
  const phases = store.business?.blueprint || []
  const allItems = phases.flatMap((p) => p.items || [])
  const milestones = store.business?.milestones || []
  return {
    blueprintDone: allItems.filter((i) => i.done).length,
    blueprintTotal: allItems.length,
    milestonesDone: milestones.filter((i) => i.done).length,
    milestonesTotal: milestones.length,
  }
}

// Paperwork expiring soon — reads expiry dates on blueprint items
// (insurance lines). Used by the home screen and by reminders.
export function complianceExpiringSoon(store, withinDays) {
  const out = []
  const today = todayISO()
  const phases = store.business?.blueprint || []
  for (const p of phases) {
    for (const item of p.items || []) {
      if (!item.expiryDate) continue
      const d = daysBetween(today, item.expiryDate)
      if (d !== null && d >= 0 && d <= (withinDays || 30)) out.push({ item, phase: p.title, expiry: item.expiryDate, daysLeft: d })
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

export function defaultBusiness() {
  return {
    blueprint: defaultBlueprint(),
    budget: defaultBudget(),
    milestones: defaultMilestones(),
  }
}

// Merge saved business data onto defaults, so a store saved by an older
// version (or a backup) never loses a section. Also migrates the v1.1
// compliance shape { items: [...] } into the blueprint's Phase 1 items.
export function mergeBusiness(saved, base) {
  const out = {
    blueprint: base.blueprint,
    budget: base.budget,
    milestones: base.milestones,
  }
  if (!saved || typeof saved !== 'object') return out
  if (Array.isArray(saved.blueprint) && saved.blueprint.length) out.blueprint = saved.blueprint
  if (saved.budget && Array.isArray(saved.budget.startup) && Array.isArray(saved.budget.monthly)) out.budget = saved.budget
  if (Array.isArray(saved.milestones) && saved.milestones.length) out.milestones = saved.milestones
  if (Array.isArray(saved.items) && saved.items.length && (!saved.blueprint || !saved.blueprint.length)) {
    // Old v1.1 compliance list → Phase 1 blueprint items.
    const byId = {}
    for (const it of saved.items) byId[it.id] = it
    out.blueprint = base.blueprint.map((phase) => ({
      ...phase,
      items: (phase.items || []).map((item) => {
        const old = byId[item.id]
        if (!old) return item
        return { ...item, done: old.status === 'done', doneAt: old.status === 'done' ? (old.doneAt || '') : '', expiryDate: old.expiryDate || item.expiryDate || '' }
      }),
    }))
  }
  return out
}

export function defaultStore() {
  return {
    version: 1,
    jobs: [],
    customers: {},
    business: defaultBusiness(),
    assemblies: defaultAssemblies(),
    settings: {
      businessName: 'AtotheI Carpentry',
      businessPhone: '',
      businessEmail: '',
      // Physical business address — HRRA requires it on the contract.
      // Must not be a P.O. Box (the app warns if it looks like one).
      businessAddress: '',
      // Illinois sales tax: 6.25% state base + the local rate for your
      // municipality, which you enter — the app does NOT look rates up.
      taxStateRate: 6.25,
      taxLocalRate: 0,
      // Municipal license numbers, per city — auto-inserted on quotes,
      // invoices, and contracts.
      municipalLicenses: [],
      geminiApiKey: '',
      geminiModel: 'gemini-3.8-flash',
      defaultLaborRate: 65,
      // Pricing defaults — new bids start with these. Markup default is
      // 20%, inside the usual 15–30% range for materials.
      minDayRate: 0,
      defaultOverheadPct: 0,
      defaultMarkupPct: 20,
      quoteValidityDays: 30,
      // Retainage held back from each progress payment; released at
      // completion. Default 10%. Per-job value wins when set.
      retainagePct: 10,
      googleReviewUrl: '',
      notificationsEnabled: true,
      statusPageUrl: 'https://jeramyadams37-dev.github.io/carpentry-jobs-app/customer-status.html',
      feedbackFormUrl: '',
    },
    aiGeneral: [],
    lastBackupAt: '',
  }
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.jobs)) return defaultStore()
    const base = defaultStore()
    return {
      ...base, ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      customers: parsed.customers || {},
      business: mergeBusiness(parsed.business, base.business),
      lastBackupAt: parsed.lastBackupAt || '',
    }
  } catch (e) {
    return defaultStore()
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
    return true
  } catch (e) {
    return false
  }
}

export function exportJSON(store) {
  return JSON.stringify({ exportedAt: nowISO(), app: 'carpentry-jobs', version: 1, ...store }, null, 2)
}

// ---- QuickBooks Online CSV export (v1 alternative — NOT two-way sync) ----
// One CSV with the transactions QuickBooks Online can import: invoices
// (one row per accepted job, tax split out), expenses, and payments.
// Import it in QuickBooks Online via Settings → Import data, then map the
// columns on the import screen. Two-way sync is NOT v1 — it needs a
// backend + OAuth, and this app is local-first.
export function quickbooksCSV(store, period) {
  const inRange = (iso) => !period || !iso || (iso >= period.start && iso <= period.end)
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = [['Date', 'Type', 'Customer', 'Job', 'Description', 'Category', 'Amount', 'Sales Tax']]
  for (const j of store.jobs || []) {
    const bid = acceptedBid(j)
    if (bid) {
      const date = j.finishedDate || j.createdAt.slice(0, 10)
      if (inRange(date)) {
        rows.push([date, 'Invoice', j.customerName || '', j.title || '', `Invoice — ${j.title || ''}`, 'Income', bidTotal(bid).toFixed(2), bidTax(bid, store.settings).toFixed(2)])
      }
    }
    for (const e of j.expenses || []) {
      if (inRange(e.date)) rows.push([e.date || '', 'Expense', j.customerName || '', j.title || '', e.description || e.category || 'Expense', e.category || 'Materials', (-Math.abs(Number(e.amount) || 0)).toFixed(2), ''])
    }
    for (const p of j.payments || []) {
      if (inRange(p.date)) rows.push([p.date || '', 'Payment', j.customerName || '', j.title || '', p.note || `Payment — ${j.title || ''}`, 'Payment received', (Number(p.amount) || 0).toFixed(2), ''])
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

export function parseImport(text) {
  const parsed = JSON.parse(text)
  if (!parsed || !Array.isArray(parsed.jobs)) throw new Error('That file does not look like a Bid to Finish backup (no jobs list).')
  return {
    version: 1,
    jobs: parsed.jobs,
    customers: parsed.customers || {},
    business: mergeBusiness(parsed.business, defaultBusiness()),
    assemblies: Array.isArray(parsed.assemblies) && parsed.assemblies.length ? parsed.assemblies : defaultAssemblies(),
    settings: { ...defaultStore().settings, ...(parsed.settings || {}) },
    aiGeneral: Array.isArray(parsed.aiGeneral) ? parsed.aiGeneral : [],
    lastBackupAt: parsed.lastBackupAt || '',
  }
}
