// Business plan reference — the full plan as readable in-app text.
// Single source of truth: the Business screen shows it, and the Business
// Plan PDF export (lib/pdf.js) prints the same sections. Edit here and
// both stay in sync. This is a living reference, not legal advice.
export const PLAN_SECTIONS = [
  {
    id: 'summary',
    title: 'Executive summary',
    body: [
      'A one-person carpentry business built on measured work, written scopes, and finished jobs that sell the next job. Services are finish/trim, custom cabinetry and built-ins, framing, and remodeling for homeowners — plus trim and framing packages for builders and remodelers.',
      'The model is simple: every price comes from a measured take-off on site, never a walk-through guess. The scope names the finish (paint grade or stain grade) and who does the finishing before the first cut. Changes are agreed in writing before the extra work starts.',
      'Success in twelve months looks like this: a month of work booked ahead, two or three builders sending regular work, and every job priced from a measured take-off instead of a guess.',
    ],
  },
  {
    id: 'services',
    title: 'Services',
    body: [
      'Finish carpentry: baseboard, casing, crown, wainscot, interior doors, stairs, handrails and railings.',
      'Custom cabinetry and built-ins: bookcases, window seats, closet systems, custom millwork.',
      'Framing: trim and framing packages for builders and remodelers.',
      'Remodeling and repair: general carpentry, decks, stairs, and repairs.',
      'Licensed electrical, plumbing, and structural work goes to the trade that holds the license — it is never done in-house.',
    ],
  },
  {
    id: 'market',
    title: 'Market — who buys',
    body: [
      'Homeowners who want built-ins, trim, or a staircase done properly without committing to a whole remodel.',
      'Builders and remodeling contractors who need a finish or framing sub they can actually schedule.',
      'Kitchen designers, interior designers, and architects who specify custom millwork and need someone who can build what they drew.',
      'Landlords, property managers, and realtors with stair, door, and trim work before a sale or a new tenant.',
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing — how work finds you',
    body: [
      'Carpentry is bought with the eyes, so the marketing is the photographs. Every finished job is photographed properly — the whole room, then the joints and the returns close up, because that detail is what a designer looks for.',
      'Word of mouth carries most of it: the neighbor who asked who built the bookcase, the builder whose trim package landed on time.',
      'Google Business Profile and Google Maps — “carpenter near me”, “custom built-ins” plus your town. Ask every happy customer for a Google review.',
      'Before/after photos on Facebook and Instagram, and ads built from finished jobs in this app — with only testimonials the customer said yes to.',
      'Two or three steady builder and remodeler accounts fill the weeks between homeowner jobs.',
    ],
  },
  {
    id: 'operations',
    title: 'Operations — how a job runs',
    body: [
      'Measured take-offs, not walk-through guesses. Every price comes from measurements taken on site.',
      'Written scope that names paint grade or stain grade, who does the finishing, and what happens where the wall or floor is not true.',
      'Payment schedule: 50% deposit on signing, 40% at rough-in / delivery, 10% at final walkthrough. A deposit comes before material is ordered, then progress payments as the job moves.',
      'Change orders in writing, priced and signed before the extra work starts. Verbal changes do not change the contract.',
      'Code checklists on every job, permits where the work needs one, a punch list before Done, warranty tracking after, and follow-ups that keep the customer warm.',
      'Record the hours a job actually took against the hours it was quoted at — that is the only way the next quote gets better.',
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing — how a price is built',
    body: [
      'Hourly labor rate that carries wages, overhead, insurance, and profit — not just take-home pay. The rate has to carry the insurance, the van, tool replacement, and every unpaid hour spent measuring and buying material.',
      'Materials markup of 15–30% to cover procurement time and waste. The app defaults new bids to 20%.',
      'Minimum day rate on small trim jobs — setting up saws, dust extraction, and a bench costs the same hour whether the job is one door or ten.',
      'Quote validity and a material-price clause: lumber and sheet-goods prices move between quote and build, and a fixed price with no clause absorbs the difference. Quotes carry a valid-until date.',
      'Overhead rate on every bid for the unpaid hours — measuring, buying material, admin — so the price is honest about what a job really costs.',
    ],
  },
  {
    id: 'risks',
    title: 'Risks — said out loud',
    body: [
      'Price moves: lumber and sheet-goods prices move between quote and build. The material-price clause and quote expiry exist for this.',
      'License and permits: working above your state’s license threshold, or on a job that needed a permit, can cost far more than a fine. In Illinois, general carpentry is regulated at the city/county level — check the city or county you actually work in.',
      'Injury and dust: saws and falls are what actually injure carpenters, and wood dust is a slow one. Extraction, guards, and a policy are part of the cost of working, not an upgrade.',
      'Builder dependence: builder work fills the weeks but pays less per hour than going direct, and a builder who slows down empties a large part of the calendar at once. Keep both sources of work.',
      'Vehicle: a running work vehicle is the gating item. No truck, no jobs. Fix one or buy used — the budget leaves the vehicle price blank until a real one is found.',
      'Carpentry is the trade whose mistakes stay on show: nobody can see a rewire, everybody can see a stair that creaks or a door that binds.',
    ],
  },
  {
    id: 'team',
    title: 'Team — solo now, help later',
    body: [
      'Solo now: measure, quote, and build the work yourself in year one.',
      'A helper comes on when the booked work would keep one busy — once you are booked out 6–8 weeks in advance — not when the week feels heavy.',
      'The helper handles material prep, sanding, and cleanup so you can focus on high-skill installation and bidding.',
      'The day a helper starts, nearly every state wants workers’ compensation — check before the first Saturday you pay someone.',
    ],
  },
]
