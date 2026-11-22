# Bid to Finish — AtotheI

A phone app for carpentry jobs, from bid to finish. Jobs pipeline, estimate
builder, before-photo analysis, time tracking, invoices, receipts, profit/loss,
calendar, contracts, lien waivers, punch lists, permits, warranty, maintenance,
customer directory, reports, reminders, feedback, ads from finished jobs, and
a Gemini AI helper. **Local-first, offline, no backend, no account.** All data
lives on the phone. Your Gemini key (if you add one) lives on the phone too.

- **App ID:** `com.atothei.carpentryjobs`
- **Stack:** Capacitor + Vite + React (same pattern as AutoHustle)
- **Version:** 1.2.1

---

## What's new in v1.2.1

- **Launcher icon actually fixed** — v1.2.0 renamed the app and redrew the launcher PNGs, but Android 16 uses the adaptive icon, and that still pointed at the old Capacitor robot. This build ships proper adaptive-icon assets: the orange hammer as the foreground and the dark tile as the background, generated from `assets/icon.svg`. **Uninstall the old app from your phone first, then install this APK** — installing over the old one often keeps the launcher's cached old icon. Your jobs are safe: the app auto-backs up to Documents and restore reads both old and new backup names.
- **Gemini bid drafts use the full chat history** — the Bids-tab "Draft bid with Gemini" button and the chat "Apply this answer to the bid" button now send the whole Gemini conversation on the job along with the job fields (most recent 20 messages if the chat is very long), so corrections, tenant and occupancy details, phase structure, and prices already discussed in chat make it into the draft. Jobs with no chat history work exactly as before. Drafts are still drafts — you review every line before anything is final.
- **Dark mode + more color** — the app was nearly all white. Dark is now the default (dark slate screens, light text, orange brand accents), with a Light / Dark switch in Settings that takes effect right away. Light mode got color too: warm background, orange topbar line, orange section bars and stat tiles, orange active chips.
- **Document previews** — quotes, contracts, and timesheets can now be read inside the app before anything is sent: "Preview quote" on the Bids tab, "Preview contract" on the Contract tab, "Preview timesheet" on the Time tab. Each preview shows exactly what its PDF will contain (same numbers, same lines, built from the same data), with a Share button that shares the matching PDF — the timesheet shares as text, since it has no PDF. Previews are read-only; editing still happens on the tabs.
- **Material price book** — Settings now has an editable price book (name, unit price, taxable). When adding a material line to a bid, pick from the price book and the name, price, and tax flag fill in. It comes seeded with nine common item names only (drywall 1/2" 4x8, 2x4x8 stud, joint compound, drywall screws, paint gallon, primer, trim, caulk, insulation batt) with blank prices for you to fill — no prices invented.
- **Job templates** — "New job from template" on Home and the Jobs tab: drywall patch, interior wall rebuild, trim install/replace, deck repair, door hang. Each pre-fills description/scope, starter materials (priced from your price book where a price exists), labor hours, and a starter punch list. Everything is editable after creation, like any job.
- **Shopping list from the accepted bid** — once a bid is accepted, the Bids tab shows a shopping list of its materials with quantities, check-off boxes as you buy them, and a running total (all materials vs still to buy). Checked state stays on the job.
- **Voice notes** — on a job's Notes section, record a voice note with the phone mic, play it back in-app, and optionally "Transcribe with Gemini" (your key) to turn it into a text note. If transcription fails, the recording is still saved.
- **Auto payment reminders** — when an invoice or milestone is overdue, the Money tab shows "Remind customer" (and a "Remind" button per overdue milestone). It drafts the reminder text (amount, job, due date) and opens the share sheet so you tap send — nothing is ever sent automatically. Overdue invoices also show up on Home under "Needs attention".
- **Deposit due alerts** — Home "Needs attention" lists jobs starting within 7 days with no deposit recorded, and the job Overview warns when the scheduled date is near and no deposit payment exists.
- **Helper hours** — the Time tab logs helper entries (name, hours, rate, date) per job; helper pay feeds the job's actual costs and P&L, and helper hours now appear on the timesheet preview.
- **Quote expiry nudges** — next to a quote's expiry date: "Extend quote by 14 days", "Re-quote as a new draft", and "Nudge customer" (drafts a follow-up message for you to send). Expiring/expired quotes appear on Home under "Needs attention".
- **End-of-day summary** — a "Today" card on Home: hours logged today, money in today, jobs due today, overdue count, and a line for yesterday. A card, not a notification.
- **Weather check on scheduled jobs** — on a job Overview, "Check weather" geocodes the job address (OpenStreetMap, free, no key) and fetches the Open-Meteo forecast for the scheduled date, warning clearly if rain is likely. The result is cached on the job. If there is no address, no date, or no network, it shows a plain note instead of an error.

---

## What's new in v1.2

- **Renamed to Bid to Finish** — same app, new name and a new hammer launcher icon. The app ID is unchanged, so v1.2 installs right over the old Carpentry Jobs build.
- **Gemini builds the bid — you review it** — two new buttons, both drafts only, nothing is ever accepted or final without you. In the Bids tab, "✨ Draft bid with Gemini" drafts a full bid from the job (description, measurements, notes, your labor rate and markup) as editable line items on a new bid. In the Ask Gemini chat, "✨ Apply this answer to the bid" under any Gemini answer pulls the numbers out of that answer into a new bid draft on the same job. Prices are always single numbers — if Gemini's answer gives a range, the draft uses the fixed price stated or the midpoint, and says so in the notes. Phases go in the scope/notes text with all line items merged into one bid.
- **Gemini default is now gemini-3.8-flash** — Google retired gemini-2.0-flash. The new default works on the free tier. If you already typed `gemini-3.8-flash` into Settings, nothing changes for you.
- **Release step fixed** — the build token now has `contents: write`, so tagged builds create the GitHub Release with the APK attached (v1.1's release step failed on permissions).

---

## What's new in v1.1

- **Enquiry / lead stage** before Bid — someone asked, no quote yet. Enquiries
  list on Home; convert one to a bid in one tap on the job screen.
- **Quoted hours vs actual hours** — the accepted bid's quoted labor hours
  against clocked actual hours, on the job (Time tab) and in Reports. The gap
  is how the next quote gets better.
- **Finish details in scope** — paint grade vs stain grade, and who does the
  finishing. Shown on the quote PDF and written into the contract.
- **Quote expiry + material-price clause** — a valid-until date on every quote
  (expired quotes flagged on the job and shown on the quote PDF), and a
  material-price clause in the quote and contract.
- **Pricing settings** (Settings) — minimum day rate, default hourly labor
  rate, default overhead rate, default materials markup (20%, inside the
  usual 15–30% range). New bids start with these; the estimate builder uses
  them as defaults.
- **Customer type** — homeowner / builder / designer / property manager, on
  the customer record and the New Job form. Reports split revenue, jobs, and
  win rate by type.
- **Business plan & setup screen** — the full plan as a living in-app
  reference (summary, services, market, marketing, operations, pricing,
  risks, team), the Startup-to-Finish blueprint as a checkable list
  (Phase 1–4, merged with the compliance/paperwork items — insurance lines
  carry expiry dates with reminders), editable startup + monthly budget
  tables (typical/planning figures, vehicle price left blank on purpose),
  30/60/90-day milestones, and a **Business Plan PDF export**. Illinois
  note included: general carpentry is regulated at the city/county level
  here, not by a state license.
- **Progress billing with retainage (AIA-style)** — per job, pick Milestones
  (50/40/10) or Progress billing. Progress builds a schedule of values from
  the accepted bid, tracks percent complete per line, and computes
  earned-to-date, previously billed, and this period's amount. Retainage
  (default 10%, changeable in Settings and per job) is held back from each
  progress payment and released at completion with the final walkthrough.
  **Pay application PDF (G702/G703-style)** — application for payment +
  continuation sheet, saved to Downloads and shareable. Marked clearly as a
  template, not an official AIA form and not legal advice.
- **Illinois HRRA compliance (headline)** — for residential jobs over
  $1,000: the contract auto-attaches the Illinois Attorney General's
  pamphlet "Home Repair: Know Your Consumer Rights" (plain-language summary
  of what it covers, in-app and on the contract PDF — no invented statute
  text), and the customer's signed acknowledgment (typed name + date) is a
  HARD GATE before the job can move to Scheduled or In Progress, like the
  code-checklist gate. The contract carries your physical business address
  (Settings field, warns if it looks like a P.O. Box), start date and
  estimated completion date, plus separate initial boxes where the homeowner
  accepts OR rejects binding arbitration and accepts OR rejects a jury trial
  waiver (initials + date, printed on the contract PDF). Jobs $1,000 and
  under skip the gate — the threshold is shown in-app.
- **Illinois sales tax** — each material line marked taxable (materials,
  fabricated custom millwork) vs non-taxable (installation labor). Rate in
  Settings: Illinois 6.25% state base + your municipality's local rate, which
  you enter — the app does NOT look rates up. Quotes and invoices show the
  tax split by category; tax due and tax collected are tracked per job and in
  Reports.
- **Municipal licenses + COI** — license numbers per city stored in
  Settings/Business and auto-inserted on quotes, invoices, and contracts.
  Insurance lines on the Business screen now take a COI (certificate of
  insurance) document attach, alongside the expiry dates and reminders.
- **Assembly-based quoting** — reusable quote assemblies (starter set:
  interior door install, baseboard per linear foot, deck per square foot)
  bundling lumber, consumables, and a waste-factor %. Applying one to a bid
  fills its line items. Save any bid you already priced as a new assembly.
- **Change order workflow** — photo attach, extra labor + materials priced,
  and the client's e-signature (typed name + date) BEFORE the extra work
  starts. An unsigned change order shows "NOT APPROVED — do not start" on
  the job.
- **GPS time tracking** — clock in/out stamps GPS coordinates on the time
  entry (the app asks for location permission); the location shows on the
  entry and feeds job costing and Reports.
- **Job files** — new attachment kinds: shop drawing, cut list, measurement,
  alongside contract / receipt / plan / permit.
- **Payment schedules** — 40% deposit / 40% rough-in / 20% completion added
  as a second default template alongside 50/40/10. Pick per job.
- **QuickBooks export (CSV)** — invoices, expenses, and payments exported
  from Reports (this period or everything) formatted for QuickBooks Online
  import. One-way only — two-way sync is NOT v1.

---

## What it does (full v1.1 scope)

**Jobs**
- Pipeline: Enquiry → Bid → Accepted → Scheduled → In Progress → Done →
  Follow-up. A job can also end as **Bid lost** or **Cancelled** — bids stay
  on record.
- Job detail: customer, customer type, phone, address, description, job type,
  dates, lead source, timestamped notes, before/after photos (camera +
  gallery).

**Estimates & bids**
- **Estimate builder** on every bid: measurements (length / width / height,
  sq ft auto from L×W, linear ft), materials with qty × unit price, labor
  hours × rate, other costs, overhead %, markup %. Every bid is built with
  it — no typed total. New bids start with the pricing defaults from
  Settings (labor rate, overhead, markup, quote validity).
- **Multiple bids per job** (different scope / price), side-by-side comparison
  (materials / labor / other / overhead / markup / finish / validity), mark
  one accepted — the accepted bid drives the job's price and applies the
  50/40/10 payment plan. Unaccepted bids stay on record.
- **Finish details** on every bid: paint grade vs stain grade, who does the
  finishing. Written into the quote PDF and the contract.
- **Quote expiry:** every quote carries a valid-until date (default from
  Settings); expired quotes are flagged on the job. Material-price clause in
  the quote and contract.
- **Before-photo analysis:** attach before photos to a bid, tap **Analyze
  photos**. Gemini (your own key) drafts scope, materials + quantities,
  labor-hours estimate, and possible code issues. The draft feeds the estimate
  builder as an editable starting point — **you review and adjust every line;
  it never finalizes on its own.** Plain fact: analyzed photos are sent to
  Google's Gemini API. Without a key the button tells you a key is needed.

**Money**
- Financials per job: quoted bid, materials / labor / other costs, payments
  received (deposit / progress / final / partials), computed profit/loss.
  Quoted vs actual stay separate so the gap is visible.
- **Time tracking:** clock in/out per job, per worker (you + helpers). Hours
  feed labor cost into the P&L automatically at the job's labor rate.
  **Quoted vs actual hours** on the Time tab and in Reports — the gap is how
  the next quote gets better.
- **Invoices:** states sent / partial / paid / overdue (overdue is automatic
  once a sent invoice passes its due date), due dates, overdue list on the
  home screen, one-tap payment-reminder text to the customer.
- **Payment schedule:** default 50% deposit / 40% at rough-in or delivery /
  10% at final walkthrough, applied when a bid is accepted, editable per job.
  Printed on the contract and invoice PDFs.
- **Progress billing (AIA-style):** per job, switch to progress billing —
  schedule of values from the accepted bid, percent complete per line,
  earned-to-date / previously billed / current due / balance to finish.
  Retainage (default 10%) held back from each progress payment, released at
  completion with the final walkthrough. **Pay application PDF
  (G702/G703-style)** — template, not an official AIA form.
- **Receipt capture:** photo a receipt — amount + vendor + category saved as a
  structured expense. With your Gemini key set, Gemini vision prefills it;
  otherwise fill it in by hand.
- **Lien waiver:** final-payment waiver PDF on completion/payment, marked
  `DRAFT TEMPLATE - NOT LEGAL ADVICE`.

**Closeout**
- **Punch list** per job — must be clear (alongside the code checklist)
  before a job can be marked Done.
- **Permits & inspections:** permit number, status, inspector contact,
  inspection dates on the calendar (reminder the day before).
- **Warranty tracking:** warranty months per job, expiry date, reminder 7 days
  before. Warranty fixes are flagged separately from paid fixes.
- **Recurring maintenance:** set an interval (e.g. deck seal every 24
  months); reminder on dashboard/calendar; turn it into a new bid/job in one tap.

**Customers & business**
- **Customer directory:** every customer with all their jobs, repeat-customer
  flag, customer type (homeowner / builder / designer / property manager),
  lead source (Facebook ad / referral / repeat / Google / other), win
  rate per customer and overall.
- **Reports:** monthly / quarterly revenue, costs, profit, jobs by type,
  average job value, win rate, top customers, revenue/jobs/win rate by
  customer type, quoted vs actual hours.
- **Business plan & setup:** the full plan as in-app reference, the
  Startup-to-Finish blueprint checklist (Phase 1–4, merged with the
  compliance items — insurance lines carry expiry dates with reminders),
  editable startup + monthly budgets, 30/60/90-day milestones, Business Plan
  PDF export. Illinois note: general carpentry is regulated at the
  city/county level, not by a state license.
- **Review requests:** after a completed job with good feedback (4★+), one-tap
  share of your Google review link (set the URL in Settings).
- **Local notifications** (permission asked in-app): follow-ups due, overdue
  invoices, warranty expiry, inspection dates, recurring maintenance.
  Scheduled when the app opens — open the app once a day and they stay fresh.

**Calendar / tracker**
- Month view: jobs scheduled, started, finished, follow-ups due, inspections,
  maintenance due. Lists grouped by status. Follow-ups due list. Overdue
  follow-ups surface on the home screen.

**Contracts & code**
- **Contracts:** plain-English draft PDF from the accepted bid — scope, price,
  payment schedule (deposit / progress / final), timeline, change-order terms,
  warranty. Every page marked `DRAFT TEMPLATE - NOT LEGAL ADVICE` — have a
  local attorney review it. Signature lines; signed contract stored on the
  job (photo/scan upload or in-app acceptance with date). Change orders are
  amendments with their own price and signature.
- **Building code reference:** stairs (IRC R311.7), decks, framing,
  railings/guards, egress — searchable, plain language, section cited. Each
  job links relevant sections and gets a code checklist that must be checked
  off before Done. Gemini can answer code questions with the job attached.
  Reference only, not legal advice — the local inspector has the final say.

**Feedback**
- Mid-job check-in and completion forms, filled in-app on your phone (hand
  the phone to the customer): stars, quality, timeliness, communication,
  cleanliness, concerns, improvements, testimonial, customer name + date,
  and the consent toggle **"May I use your words in my ads?"**
- Concerns auto-create a fix task; improvements auto-create a follow-up.
- **Testimonials:** only consent=yes ever feeds the ad generator. The ad
  screen shows which testimonials are approved.
- Satisfaction tracking: per-job rating, dashboard average + trend.
- Printable paper feedback form PDF; a completed form exports as PDF.

**Ads from jobs**
- From a finished job: Facebook-ready ad draft — before/after photos,
  caption, call to action ("Message for a free quote") — Share (Android share
  sheet) + Copy Text. Paid ads are NOT in v1 (see "Not in v1" below).

**Customer code system**
- Every job gets a short unique 6-character code, shown on the job screen,
  regenerable, never reused. Link generator: customer status link + feedback
  form link, shareable / copyable. URL pattern configurable in Settings.
- The app's export includes a public status file (`jobs.json`) with ONLY
  code → customer first name, job type, status. Never address, phone, money,
  notes, or photos. A `customer-status.html` page in this repo reads it.
  The pattern is deliberately simple and generic (short code + public JSON
  lookup + no private data) so it can be reused for future ideas.

**Gemini AI ("Ask Gemini" / "AI Help")**
- Estimating, material lists, code questions, how to fix an issue, pricing
  advice, ad copy help, general questions. Suggested prompt chips.
- **Bring your own key, exactly like AutoHustle:** paste your OWN Gemini key
  in Settings — stored on-device only. No key is bundled in the app, code,
  chat, or repo, and there is no shared-key fallback. No key = the screen
  explains how to get a free one from Google AI Studio.
- Free tier: default model `gemini-3.8-flash`, changeable in Settings.
  Requests go straight from the phone to Google — no backend, no middleman.
- Job-aware: asking from a job attaches that job's context (description,
  materials, tools, bid amounts, notes). General mode works with no job.
  Chat history saved per job, general history kept on-device.

**Data safety — never lose job/customer data**
- **Automatic backup:** once a day when the app opens, a dated JSON backup
  is saved to Documents (`carpentry-jobs-backups/`), last 7 kept. The home
  screen shows the last backup time; Settings can restore the latest one in
  one tap.
- Manual JSON export of all jobs/notes/photos metadata to Downloads, and
  import/restore from that file. Confirm before any delete.

---

## Not in v1 (follow-up decisions)

- **Paid ads** — the ad screen makes post-ready drafts for Facebook. Boosting
  / paid campaigns are a later decision.
- **Web-link feedback form** — no backend, so there is no link the customer
  fills in from their own phone. In v1 the customer fills the form on your
  phone in the app, or on the printed form. (The free v2 setup below uses one
  Google Form + GitHub Pages for status links.)
- **Google Drive sync** — automatic backup is to the phone's Documents folder.
  Drive sync is a follow-up; meanwhile the share sheet can send any backup
  straight to Drive.
- **Contracts and code reference are drafts/reference only** — see above.
- **Photo analysis sends photos to Google** — see the estimate section.
- **Tap to Pay & ACH — NOT in v1.** There is no payment processor in a
  local-first app. V1 records payments (cash, check, card taken elsewhere).
  Follow-up: a Stripe payment link on the invoice, or Stripe Terminal later.
- **Two-way QuickBooks sync — NOT in v1.** V1 is a one-way CSV export for
  QuickBooks Online import. Two-way sync needs a backend + OAuth.
- **QuickBooks CSV import mapping** — QuickBooks Online asks you to map the
  CSV columns on import; the file uses plain column names (Date, Type,
  Customer, Job, Description, Category, Amount, Sales Tax) for that screen.

---

## Offline — works with no signal

The app is local-first: everything lives on the phone. Hours, checklists,
photos, blueprints, and attachments all work offline with no signal — there
is no server to sync to and no sync step. Open the app, do the work, and the
data is there when you get back to signal. Backups are local (daily auto
backup to the phone's Documents folder, plus manual export/share).

## Get it on your phone

### 1. Create the GitHub repo (on the phone, Termux)

```bash
gh repo create carpentry-jobs-app --public --description "Bid to Finish — AtotheI. Local-first Capacitor app for carpentry jobs, bid to finish."
```

### 2. Unzip this project and push it

The zip is `carpentry-jobs-app-v1.2.1.zip`. Copy it to Downloads first, then:

```bash
cd ~/storage/downloads
rm -rf carpentry-jobs-app
unzip -o carpentry-jobs-app-v1.2.1.zip
cd carpentry-jobs-app
git init -b main
git add .
git commit -m "Bid to Finish v1.2.1"
git remote add origin https://github.com/jeramyadams37-dev/carpentry-jobs-app.git
git push -u origin main
```

(If `git push` asks to sign in, use `gh auth login` once, then push again.)

### 3. Make a NEW release keystore for this app

A new app needs its own keystore — **do NOT reuse AutoHustle's keystore**.
Run this in Termux. It asks for two passwords — use different, strong ones
and write them down somewhere safe (not in the repo, not in chat).

```bash
cd "$TMPDIR"
keytool -genkeypair -v -keystore carpentry-release.keystore -alias carpentry -keyalg RSA -keysize 2048 -validity 10000
```

Then turn it into the secret the workflow needs:

```bash
base64 -w0 carpentry-release.keystore > carpentry-release.keystore.b64
cat carpentry-release.keystore.b64
```

Copy that long base64 line (it is one line — paste it whole).

### 4. Add the four repo secrets

GitHub → your repo → **Settings → Secrets and variables → Actions → New
repository secret**. Add all four:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the base64 line from step 3 |
| `KEYSTORE_PASSWORD` | the keystore password you typed |
| `KEY_ALIAS` | `carpentry` |
| `KEY_PASSWORD` | the key password you typed |

The workflow only builds a **signed release** when these exist. Without
them, a manual run builds a debug APK instead.

### 5. Tag a release and let Actions build it

```bash
cd ~/storage/downloads/carpentry-jobs-app
git tag v1.2.1
git push origin v1.2.1
```

Then GitHub → repo → **Actions** → watch the "Build Bid to Finish APK"
run. When it is green, open the run → **Artifacts** → download
`BidToFinish.apk` (or grab it from the GitHub Release the run creates).

To rebuild after a change, bump the tag (`v1.2.1`, …) and push it.

### 6. Install on the phone — delete the old APK first

```bash
rm -f ~/storage/downloads/BidToFinish.apk
```

Then download the fresh APK into Downloads (browser, or `gh run download`),
and install it:

```bash
termux-open ~/storage/downloads/BidToFinish.apk
```

If the install prompt does not surface, tap the APK in the Files app.
If the phone says the package conflicts with an existing app, uninstall the
old app first, then install again. (Uninstalling wipes the app's
data — **export a backup from Settings first**.)

---

## First run checklist

1. Open the app → **More → Settings & data**.
2. Fill in business name / phone / email (used on PDFs and ads).
3. Paste your **Gemini API key** (free from Google AI Studio,
   aistudio.google.com → Get API key) and tap **Test key**.
4. Set your **default labor rate** ($/hr) and your **Google review link**.
5. Tap **Enable reminders** and allow notifications.
6. Create a test job, add a bid with the estimate builder, accept it, mark
   it Done — then delete the test job (or keep it, it is yours).
7. Export a backup once (Settings → Export backup) so you know where it lands.

---

## Free v2 setup — customer status page + feedback form

No backend, no cost. Two pieces:

1. **GitHub Pages (status page):** in the repo, Settings → Pages → deploy
   from the `main` branch. That publishes `customer-status.html` and the
   `jobs.json` template at
   `https://jeramyadams37-dev.github.io/carpentry-jobs-app/customer-status.html`.
   In the app: Settings → **Export public status feed (jobs.json)** whenever
   a job moves, and upload that `jobs.json` next to the page (or commit it to
   the repo — it holds no private data). Customers open their status link
   (`…/customer-status.html?code=XXXXXX`) and see first name, job type,
   status, and a link to the feedback form.
2. **Google Form (feedback):** create one Google Form with a **Job code**
   field (plus the feedback questions), responses to a Google Sheet. Paste
   the form link into Settings → Feedback form URL. Copy feedback from the
   Sheet into the app by hand for now — there is no backend in v1.

**Privacy rule:** the public page shows no private data — a code is not a
password. Anyone who guesses a code sees only a first name, a job type, and
a status. Never put address, phone, money, notes, or photos in `jobs.json`.

---

## Visual checklist — check every screen after install

Tick each one off on the phone. If a screen is missing or blank, the build
is not the one in this zip.

**Home**
- [ ] Needs-attention card: enquiries waiting for a quote, bids awaiting
      answer, jobs scheduled this week, overdue follow-ups, open fixes
      (warranty fixes flagged), overdue invoices, warranty expiring,
      maintenance due, business paperwork expiring
- [ ] Totals: bids out (+ value), jobs done, revenue, costs, profit/loss,
      customer satisfaction average + trend
- [ ] Last automatic backup time shown
- [ ] Next-up job list; + New job / Calendar / Ask Gemini / Reports /
      Customers buttons

**Jobs list**
- [ ] All jobs with status pills; tap opens the job; + New job

**New job / Edit job**
- [ ] Stage (Enquiry / Bid — create only), title, customer name, customer
      type, phone, address, job type, lead source, description, scheduled date

**Job detail — Overview tab**
- [ ] Description edit + save; scheduled / started / finished dates; job type
- [ ] Status chips incl. Enquiry + Convert to bid (one tap)
- [ ] Customer code + New code; status link copy/share; feedback link
      copy/share
- [ ] Money at a glance (quoted, payments in, balance due, costs, profit)
- [ ] Timestamped notes

**Job detail — Bids tab**
- [ ] Add bid; bid labels editable; new bids start with Settings pricing
      defaults (labor rate, overhead, markup, valid-until)
- [ ] Finish details: paint/stain grade, who does the finishing
- [ ] Quote validity: valid-until date; expired quotes flagged
- [ ] Estimate builder: measurements (L/W/H, sq ft auto, linear ft),
      materials qty × unit price, labor hours × rate, other, overhead %,
      markup %, totals shown step by step
- [ ] Below-minimum-day-rate warning on small bids
- [ ] Before-photo attach (tap to attach) + **Analyze photos** button;
      Gemini draft shown with scope / materials / labor hours / code issues;
      **Use this draft as the estimate** fills the builder (editable)
- [ ] Quote assemblies: starter set (interior door install, baseboard per
      linear foot, deck per square foot) — apply to a bid with a quantity,
      lines + waste factor + labor hours fill in; save a bid as a new
      assembly; delete an assembly
- [ ] Materials: taxable checkbox per line (materials taxable, labor not);
      sales tax line on the bid (rate from Settings) + total with tax
- [ ] Compare bids side by side (materials / labor / other / overhead /
      markup / finish / validity / total / scope); Accept this bid (applies
      the 50/40/10 payment plan); Quote PDF / Share quote; Delete bid

**Job detail — Money tab**
- [ ] Billing type switch: Milestones / Progress billing
- [ ] Profit & loss: quoted vs actual (materials / labor incl. clocked hours /
      other / tool rentals), revenue, profit/loss, balance due; retainage held
      + released shown on progress jobs; sales tax on the job (due + collected
      pro-rata) shown
- [ ] Payment schedule (milestone billing): 50/40/10 AND 40/40/20 templates,
      edit percentages/labels, mark milestones paid, reset to either template
- [ ] Progress billing: schedule of values built from accepted bid, % complete
      per line, earned-to-date / less retainage / previous / current due /
      balance to finish; retainage % per job; New pay application; application
      list with Pay app PDF / Share / Mark paid; Release retainage button
- [ ] Invoice card: state (not sent / sent / partial / paid / overdue),
      due date, Invoice PDF, Share invoice, Send payment reminder, Mark paid
- [ ] Tools list: owned / rented + rental cost
- [ ] Receipt photo button + prefill form (vendor / amount / category /
      date); expenses list with receipt flag
- [ ] Payments received (deposit / progress / final / partial)

**Job detail — Time tab**
- [ ] Quoted hours vs actual hours (gap shown, "how the next quote gets
      better"); Clock in (name) / Clock out; open-entry warning; hours +
      labor cost totals per worker; entry list with delete
- [ ] GPS stamp on every clock in/out (location shown on the entry; "not
      recorded" when permission is off or location is unavailable)

**Job detail — Photos & Files tab**
- [ ] Before / After / General photo buttons; photo grid; tap to view; delete
- [ ] Attach a file (contract / receipt / plan / permit / shop drawing /
      cut list / measurement / other); Save (Downloads) and delete per
      attachment
- [ ] Printouts: Quote / Invoice / Work order PDF + Share

**Job detail — Fixes tab**
- [ ] Fix list with open/done; warranty flag checkbox + Warranty badge;
      feedback concerns land here automatically

**Job detail — Follow-ups tab**
- [ ] Follow-up list with due dates + Overdue badge; add with due date

**Job detail — Code tab**
- [ ] Code sections linked to the job; checklist with check / N/A;
      Rebuild checklist; Done blocked until finished

**Job detail — Contract tab**
- [ ] HRRA card: job amount vs the $1,000 threshold; pamphlet summary;
      customer acknowledgment (typed name + date); arbitration accept/reject
      + initials + date; jury waiver accept/reject + initials + date;
      estimated completion date; business address warning when missing
- [ ] HRRA gate: a job over $1,000 cannot move to Scheduled or In Progress
      until the pamphlet is acknowledged (blocked message names the gate)
- [ ] Contract price; Contract PDF / Share contract (PDF carries address,
      licenses, start + estimated completion dates, arbitration/jury boxes,
      pamphlet summary + acknowledgment); Record customer acceptance
- [ ] Change orders: add with title / description / extra materials /
      extra labor hours / photo attach / computed total; unsigned shows
      "NOT APPROVED — do not start"; Customer sign; Delete

**Job detail — Closeout tab**
- [ ] Punch list add / check / delete (Done blocked until clear)
- [ ] Permit number / status / inspector name / phone; inspections add +
      result (scheduled / passed / failed / rescheduled)
- [ ] Warranty months / start / expiry (auto from months)
- [ ] Recurring maintenance interval / next due / notes; Create new job
      from this maintenance
- [ ] Lien waiver: set final payment, Lien waiver PDF, Share lien waiver
- [ ] Ask for a Google review (shows after 4★+ feedback)

**Job detail — Feedback tab**
- [ ] Mid-job / Completion toggle; customer name; stars; quality /
      timeliness / communication / cleanliness; concerns; improvements;
      testimonial; consent toggle "May I use your words in my ads?"
- [ ] Save feedback; Blank paper form (PDF); past feedback with
      OK-for-ads / Not-for-ads badges; Export as PDF per entry

**Job detail — Ads tab**
- [ ] Build ad draft; editable caption; Share text / Share with photos /
      Copy text; Testimonials approved for ads list; held-back count

**Calendar**
- [ ] Month grid with dots: scheduled / started / finished / follow-up /
      inspection / maintenance; day detail; Follow-ups due list; Jobs by status

**AI Help (Ask Gemini)**
- [ ] No-key explainer with Open Settings; prompt chips; chat history;
      job-aware header when opened from a job; model shown

**Code reference**
- [ ] Searchable list: stairs (IRC R311.7), decks, framing, guards/railings,
      egress — plain language with section cited

**Reports**
- [ ] Monthly / Quarterly toggle; prev/next; revenue, costs, profit/loss,
      jobs finished, average job value, win rate; jobs by type; top customers
- [ ] By customer type: finished jobs, revenue, win rate per type
- [ ] Hours — quoted vs actual (jobs finished this period)
- [ ] Illinois sales tax: tax due vs tax collected (jobs finished this
      period), with the rate shown
- [ ] QuickBooks export: CSV of invoices / expenses / payments for this
      period, and an export-everything option

**Customers**
- [ ] Customer cards: jobs, won/lost, win rate, revenue, repeat badge;
      customer type select; lead source select; notes; job list per customer

**Business plan & setup**
- [ ] Progress: blueprint done count, milestones done count, paperwork
      expiring warnings; Business Plan PDF / Share plan PDF
- [ ] The plan tab: section chips (summary, services, market, marketing,
      operations, pricing, risks, team) with readable text; Illinois note
- [ ] Checklist tab: Phase 1–4 with checkable items + done dates; insurance
      lines with expiry date inputs + COI attach (save / remove)
- [ ] Municipal licenses card (Checklist tab): city + license number rows,
      add / remove — licenses print on quotes, invoices, and contracts
- [ ] Budget tab: startup budget rows editable (vehicle row blank on purpose),
      startup total; monthly rows editable, monthly total
- [ ] Milestones tab: 30 / 60 / 90-day groups, checkable

**Settings & data**
- [ ] Business info incl. physical business address (P.O. Box warning);
      default labor rate; Google review link
- [ ] Pricing defaults: minimum day rate, default overhead %, default
      materials markup %, quote valid for (days), retainage %
- [ ] Illinois sales tax: state base rate (6.25%) + local rate (your
      municipality), total rate shown
- [ ] Gemini key + model + Test key + AI Studio link copy
- [ ] Customer status page URL + feedback form URL + Export jobs.json
- [ ] Reminders: Enable reminders, Refresh reminders now, on/off toggle
- [ ] Backup & restore: Export / Share / Import; List automatic backups;
      Restore latest automatic backup; Delete all data (with confirm)

**Customer status page (GitHub Pages, v2)**
- [ ] `customer-status.html?code=XXXXXX` shows first name, job type,
      status, feedback-form link — and nothing private

---

## Files in this project

```
carpentry-jobs-app/
  package.json / vite.config.js / capacitor.config.ts / index.html
  src/
    App.jsx                  — screens, nav, daily auto-backup, reminders
    main.jsx / index.css
    components/ui.jsx        — pills, confirm dialog, stars, toast
    lib/store.js             — data model, money math, customers, reports,
                               progress billing + retainage, business plan
                               data (blueprint / budget / milestones)
    lib/files.js             — Downloads / share / clipboard helpers
    lib/pdf.js               — quote, invoice, work order, contract,
                               feedback form, lien waiver, business plan,
                               pay application (G702/G703-style) (jsPDF)
    lib/gemini.js            — Gemini text + vision, BYOK, job context
    lib/codeRef.js           — IRC code sections + per-job checklists
    lib/planContent.js       — business plan reference text (screen + PDF)
    lib/hrra.js              — Illinois HRRA reference (pamphlet summary,
                               $1,000 threshold, P.O. Box check)
    lib/notify.js            — local notification scheduling (incl.
                               business paperwork expiry)
    lib/backup.js            — daily dated backup, keep last 7
    screens/                 — Home, Jobs, JobForm, JobDetail, Calendar,
                               AiHelp, CodeRef, Settings, Reports, Customers,
                               Business
  assets/icon.svg
  customer-status.html       — public status page (v2, GitHub Pages)
  jobs.json                  — public status feed template
  android/                   — Capacitor Android project (generated)
  .github/workflows/android.yml — signed release APK on tags v*
```

## Notes for future work

- The customer-code pattern (`genJobCode` + `publicStatusFeed` in
  `src/lib/store.js`) is deliberately generic — short code + public JSON
  lookup + no private data — so the same pattern can be reused for future
  ideas, not hard-wired to carpentry.
- `npx cap sync android` after any web change before building the APK
  locally; the GitHub workflow does this itself.
- TypeScript is pinned to 5.8.3 in devDependencies: npm's default
  TypeScript 7 (tsgo preview) breaks the Capacitor CLI's TS config loader.
  Do not unpin it.
- In the workflow, `KEYSTORE_BASE64` is set at **job** level env, not step
  level — step-level env is not visible to a step's `if:` condition.
