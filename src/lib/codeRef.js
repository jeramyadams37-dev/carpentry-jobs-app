// Building-code reference — plain language, section cited.
// REFERENCE ONLY, not legal advice. The local jurisdiction and the
// inspector on the job have the final say. Verify locally before building.
export const CODE_SECTIONS = [
  {
    id: 'stairs',
    title: 'Stairs',
    category: 'Stairs',
    cite: 'IRC R311.7',
    summary: 'The rules that decide whether a staircase is legal to walk on.',
    rules: [
      { text: 'Riser height: max 7-3/4 in, min 4 in.', cite: 'R311.7.5.1' },
      { text: 'Riser heights in one flight may not vary by more than 3/8 in.', cite: 'R311.7.5.1' },
      { text: 'Tread depth: min 10 in (nosing to nosing).', cite: 'R311.7.5.2' },
      { text: 'Tread depths in one flight may not vary by more than 3/8 in.', cite: 'R311.7.5.2' },
      { text: 'Headroom above the stair: min 6 ft 8 in, measured from the nosing line.', cite: 'R311.7.2' },
      { text: 'Stair width: min 36 in clear.', cite: 'R311.7.1' },
      { text: 'Winder treads: min 6 in deep at the narrow end, min 10 in deep at 12 in from the narrow end (the walkline).', cite: 'R311.7.5.2.1' },
      { text: 'Spiral stairs: min 26 in clear width, tread min 7-1/2 in at 12 in from the narrow edge, riser max 9-1/2 in, headroom min 6 ft 6 in.', cite: 'R311.7.10.1' },
      { text: 'Handrail height: 34–38 in above the nosings, on at least one side.', cite: 'R311.7.8.1' },
      { text: 'A landing is required at the top and bottom of every stair, at least as wide as the stair and min 36 in deep.', cite: 'R311.7.6' },
    ],
    jobTypes: ['stairs', 'general', 'repair'],
  },
  {
    id: 'guards',
    title: 'Guards & handrails',
    category: 'Railings',
    cite: 'IRC R312 / R311.7.8',
    summary: 'Where a fall needs a guard, how high it must be, and what a handrail must feel like.',
    rules: [
      { text: 'Guards required where a walking surface is more than 30 in above the floor or grade below.', cite: 'R312.1.1' },
      { text: 'Guard height: min 36 in above the walking surface (residential).', cite: 'R312.1.2' },
      { text: 'Openings in a guard must not pass a 4-in sphere — no gap a small child can slip through.', cite: 'R312.1.3' },
      { text: 'Handrail grip: circular rails 1-1/4 to 2 in diameter; other shapes must have an equivalent graspable perimeter.', cite: 'R311.7.8.5' },
      { text: 'Handrails must run continuously the full length of the flight, and return to the wall or newel at the ends.', cite: 'R311.7.8.2' },
      { text: 'A stair open on one side needs a guard on that side; the handrail can serve as the guard if it meets guard height.', cite: 'R312.1 / R311.7.8' },
    ],
    jobTypes: ['stairs', 'deck', 'general', 'trim'],
  },
  {
    id: 'decks',
    title: 'Decks',
    category: 'Decks',
    cite: 'IRC R507',
    summary: 'How a deck connects to the house, what holds it up, and how far joists can span.',
    rules: [
      { text: 'Ledger boards must be fastened to the house framing (not just siding or sheathing) with lag screws or through-bolts.', cite: 'R507.9' },
      { text: 'Ledger flashing is required so water cannot get behind the ledger and rot the rim joist.', cite: 'R507.9.1.1' },
      { text: 'Deck joists: span depends on species, size, and spacing — check the R507.6 span tables before cutting, do not guess.', cite: 'R507.6' },
      { text: 'Posts must sit on concrete footings that go below the local frost line.', cite: 'R507.3' },
      { text: 'Deck guard height: min 36 in; baluster openings must not pass a 4-in sphere.', cite: 'R312.1 / R507' },
      { text: 'Deck stairs follow the same riser/tread rules as interior stairs (R311.7).', cite: 'R311.7' },
    ],
    jobTypes: ['deck', 'general'],
  },
  {
    id: 'framing',
    title: 'Framing',
    category: 'Framing',
    cite: 'IRC R602',
    summary: 'Stud walls, headers, plates, and what you may cut out of a stud.',
    rules: [
      { text: 'Wall studs: 16 in on center is the standard layout; 24 in on center is allowed only where the code tables permit it.', cite: 'R602.3' },
      { text: 'Double top plate required on framed walls, with joints lapped at least 24 in.', cite: 'R602.3.2' },
      { text: 'Headers over openings must be sized from the R602.7 span tables for the span and the load above.', cite: 'R602.7' },
      { text: 'Notching a bearing stud: max 25% of the stud depth. Boring a hole: max 40% of the depth, centered.', cite: 'R602.6' },
      { text: 'Bored holes must be at least 5/8 in from the edge of the stud.', cite: 'R602.6' },
      { text: 'Load-bearing walls must have continuous support down to the foundation — never cut a load-bearing stud without a header and temporary support.', cite: 'R602.7 / R602.3' },
    ],
    jobTypes: ['framing', 'general', 'repair'],
  },
  {
    id: 'egress',
    title: 'Egress & emergency escape',
    category: 'Egress',
    cite: 'IRC R311 / R310',
    summary: 'Every home needs a way out — and every bedroom needs a second way out.',
    rules: [
      { text: 'At least one egress door, min 32 in clear width and 78 in clear height.', cite: 'R311.2' },
      { text: 'Every bedroom needs an emergency escape window or door to the outside.', cite: 'R310.1' },
      { text: 'Escape window: min 5.7 sq ft clear opening (5.0 sq ft at grade floor), min 24 in high, min 20 in wide.', cite: 'R310.2' },
      { text: 'Escape window sill: max 44 in above the finished floor.', cite: 'R310.2.2' },
      { text: 'Hallways serving bedrooms: min 36 in wide.', cite: 'R311.6' },
      { text: 'Landings at exterior doors: min 36 in deep, no more than 1-1/2 in below the threshold (7-3/4 in max if the door swings in).', cite: 'R311.3' },
    ],
    jobTypes: ['framing', 'general', 'repair'],
  },
]

export function sectionsForJobType(jobType) {
  return CODE_SECTIONS.filter((s) => s.jobTypes.includes(jobType || 'general'))
}

export function checklistForJob(job) {
  const sections = (job.codeSections && job.codeSections.length)
    ? CODE_SECTIONS.filter((s) => job.codeSections.includes(s.id))
    : sectionsForJobType(job.jobType)
  const items = []
  for (const s of sections) {
    for (const r of s.rules) {
      items.push({ id: s.id + ':' + r.cite, label: `${s.title} — ${r.text}`, cite: s.cite + ' ' + r.cite, checked: false, na: false })
    }
  }
  return items
}
