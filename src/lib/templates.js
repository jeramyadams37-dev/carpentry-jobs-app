// Job templates — "New job from template" pre-fills a job so the quote
// starts half-written. Each template sets the description/scope, a starter
// bid (materials, labor hours), and a starter punch-list checklist.
// Everything is editable after creation, like any job. Material prices
// come from the price book where a price exists; the rest start at $0 for
// the carpenter to fill in on the Bids tab. No prices are invented here.
import { newJob, newBid, uid, nowISO } from './store.js'

export const JOB_TEMPLATES = [
  {
    id: 'drywall-patch',
    title: 'Drywall patch',
    jobType: 'repair',
    description: 'Patch a damaged drywall section: cut out, patch, tape and mud, texture-match, prime and paint.',
    scope: 'Cut out damaged drywall to nearest studs, screw in patch, tape and mud (3 coats, dry between coats), sand smooth, texture-match to surrounding wall, prime and paint to the nearest corner.',
    laborHours: 6,
    materials: [
      { name: 'Drywall 1/2" 4x8 sheet', qty: 1 },
      { name: 'Joint compound (bucket)', qty: 1 },
      { name: 'Drywall screws (box)', qty: 1 },
      { name: 'Primer — gallon', qty: 1 },
      { name: 'Paint — interior gallon', qty: 1 },
    ],
    checklist: [
      'Measure and mark the patch area',
      'Cut out the damaged section to the nearest studs',
      'Screw the patch to framing',
      'Tape and mud — 3 coats, dry between coats',
      'Sand smooth and texture-match',
      'Prime and paint to the nearest corner',
    ],
  },
  {
    id: 'interior-wall-rebuild',
    title: 'Interior wall rebuild',
    jobType: 'framing',
    description: 'Rebuild an interior wall: open it up, replace rotted framing, hang drywall both sides, finish and paint.',
    scope: 'Remove damaged wall covering both sides, replace rotted studs and bottom plate, hang drywall both sides, tape, mud and texture, re-hang trim, prime and paint.',
    laborHours: 16,
    materials: [
      { name: '2x4x8 stud', qty: 6 },
      { name: 'Drywall 1/2" 4x8 sheet', qty: 2 },
      { name: 'Joint compound (bucket)', qty: 2 },
      { name: 'Drywall screws (box)', qty: 1 },
      { name: 'Insulation batt', qty: 2 },
      { name: 'Trim — baseboard / casing', qty: 2 },
      { name: 'Primer — gallon', qty: 1 },
      { name: 'Paint — interior gallon', qty: 1 },
    ],
    checklist: [
      'Open the wall and find the moisture source first',
      'Replace rotted framing and bottom plate',
      'Hang drywall on both sides',
      'Tape, mud and texture',
      'Re-hang trim',
      'Prime and paint',
    ],
  },
  {
    id: 'trim-install',
    title: 'Trim install / replace',
    jobType: 'trim',
    description: 'Install or replace baseboard and casing: measure, cut, cope, nail, fill, caulk and paint.',
    scope: 'Measure and cut trim to fit, cope inside corners, nail and fill, caulk gaps, paint to match.',
    laborHours: 5,
    materials: [
      { name: 'Trim — baseboard / casing', qty: 10 },
      { name: 'Caulk (tube)', qty: 2 },
      { name: 'Paint — interior gallon', qty: 1 },
    ],
    checklist: [
      'Measure and cut trim to fit',
      'Cope inside corners',
      'Nail and fill nail holes',
      'Caulk gaps',
      'Paint',
    ],
  },
  {
    id: 'deck-repair',
    title: 'Deck repair',
    jobType: 'deck',
    description: 'Repair a deck: pull rotted boards, check joists and fasteners, lay new boards, re-fasten and seal.',
    scope: 'Pull rotted deck boards, inspect joists and blocking, replace soft framing, lay new boards with even gaps, re-fasten, check level, seal or stain if asked.',
    laborHours: 8,
    materials: [
      { name: 'Deck board 5/4x6x8', qty: 6 },
      { name: '2x4x8 stud', qty: 2 },
      { name: 'Deck screws 3in (box)', qty: 1 },
    ],
    checklist: [
      'Pull rotted boards and inspect the joists',
      'Replace blocking where it is soft',
      'Lay new boards with even gaps',
      'Re-fasten and check level',
      'Seal or stain if the customer asked for it',
    ],
  },
  {
    id: 'door-hang',
    title: 'Door hang',
    jobType: 'general',
    description: 'Hang a pre-hung interior door: set the frame plumb, shim, fasten, trim casing both sides, fit hardware.',
    scope: 'Check the rough opening is plumb and square, set the frame, shim the hinge side, fasten and check the reveal, install casing both sides, hang the door, fit hardware, test the swing.',
    laborHours: 4,
    materials: [
      { name: 'Pre-hung interior door', qty: 1 },
      { name: 'Trim — baseboard / casing', qty: 2 },
      { name: 'Caulk (tube)', qty: 1 },
      { name: 'Drywall screws (box)', qty: 1 },
    ],
    checklist: [
      'Check the rough opening is plumb and square',
      'Set the frame, shim the hinge side',
      'Fasten and check the reveal',
      'Install casing on both sides',
      'Hang the door, fit hardware, test the swing',
    ],
  },
]

export function jobFromTemplate(tpl, settings, takenCodes) {
  const job = newJob(takenCodes)
  job.title = tpl.title
  job.jobType = tpl.jobType
  job.description = tpl.description
  job.status = 'bid'
  const b = newBid()
  b.label = 'Bid 1'
  b.scope = tpl.scope
  b.laborHours = tpl.laborHours
  b.laborRate = Number(settings?.defaultLaborRate) || 65
  b.markupPct = Number(settings?.defaultMarkupPct ?? 20) || 0
  b.overheadPct = Number(settings?.defaultOverheadPct) || 0
  const validityDays = Number(settings?.quoteValidityDays ?? 30) || 0
  b.validUntil = validityDays > 0 ? new Date(Date.now() + validityDays * 86400000).toISOString().slice(0, 10) : ''
  const book = settings?.priceBook || []
  b.materials = (tpl.materials || []).map((m) => {
    const hit = book.find((x) => (x.name || '').trim().toLowerCase() === (m.name || '').trim().toLowerCase())
    return {
      id: uid(),
      name: m.name,
      qty: m.qty || 1,
      unitCost: hit ? (Number(hit.unitPrice) || 0) : (Number(m.unitCost) || 0),
      taxable: hit ? hit.taxable !== false : true,
    }
  })
  job.bids = [b]
  job.punchList = (tpl.checklist || []).map((label) => ({ id: uid(), text: label, done: false, createdAt: nowISO() }))
  return job
}
