// Illinois Home Repair and Remodeling Act (HRRA) — in-app reference.
// Plain-language summary of what the Illinois Attorney General's pamphlet
// "Home Repair: Know Your Consumer Rights" covers. This summary does NOT
// quote the statute and does NOT invent statute text — it names the rights
// the pamphlet covers. The full official pamphlet is the authoritative
// document. This is a checklist and reference, not legal advice.
export const HRRA_THRESHOLD = 1000
export const HRRA_PAMPHLET_NAME = 'Home Repair: Know Your Consumer Rights'
export const HRRA_PAMPHLET_SUMMARY = [
  'Your right to a written contract for home repair and remodeling work over $1,000 — including the contractor’s business name and physical address, a description of the work, and start and estimated completion dates.',
  'Your right to receive the Attorney General’s pamphlet “Home Repair: Know Your Consumer Rights” before work begins, and to sign an acknowledgment that you received it.',
  'Cancellation rights that may apply to contracts signed at your home — the pamphlet explains when you can cancel and how.',
  'Your right to know whether the contract includes binding arbitration or a jury trial waiver — and to accept or reject each one separately, in writing.',
  'How to file a complaint with the Illinois Attorney General’s Consumer Fraud Bureau if something goes wrong.',
  'This summary does not quote the law. Read the official pamphlet — it is the authoritative document.',
]

const PO_BOX_RE = /\bP\.?\s*O\.?\s*Box\b/i

export function looksLikePOBox(addr) {
  return PO_BOX_RE.test(String(addr || ''))
}

// HRRA applies to residential jobs over $1,000. Amount is the accepted
// bid total, or the largest bid when nothing is accepted yet.
export function hrraAmount(job, bidTotalFn) {
  const bids = job.bids || []
  if (!bids.length) return 0
  const accepted = bids.find((b) => b.id === job.acceptedBidId)
  if (accepted) return bidTotalFn(accepted)
  return Math.max(0, ...bids.map((b) => bidTotalFn(b)))
}

export function hrraApplies(job, bidTotalFn) {
  return hrraAmount(job, bidTotalFn) > HRRA_THRESHOLD
}

export function hrraAcknowledged(job) {
  return !!(job.hrra && job.hrra.pamphletAck && job.hrra.pamphletAck.signedAt)
}
