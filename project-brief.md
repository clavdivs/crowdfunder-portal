# Build Prompt: Self-Serve Investor Statement Portal (Nominee Crowd Pool, Dilution Tracking, Firebase Free Tier)

You are a senior full-stack engineer + product architect. Build an MVP web app whose purpose is to let small crowdfunding investors self-serve their ownership/dilution status and download an investor statement PDF, so they don't need to contact management. The company cap table must show only ONE line item for the crowd ("Nominee/SPV Name"), while the system tracks beneficial ownership behind it.

## Hosting + Stack (FREE TIER, Firebase-first)

Use:

* **Firebase Hosting** (free tier) for the web app
* **Firestore** (free tier) for data storage
* **Firebase Authentication**

  * Admin: email/password (single admin user)
  * Investors: **email magic link** sign-in (expires in 24 hours)
* **Cloud Functions** for:

  * pro-rata allocation compute + locking
  * dilution calculations (server-side)
  * server-side PDF generation
  * contact form delivery (store + optionally email admin)

Design to minimize ops and remain within free-tier usage for small/medium rounds.

---

# 1) Core Concepts

## 1.1 One Nominee on Cap Table

* The real cap table shows **one holder only** for the crowd: `nomineeName`
* All individual crowdfunders are tracked as **beneficial owners behind the nominee**

## 1.2 Crowd Pool Percent at Close

At crowdfund close, admin sets:

* `crowdPercentAtClose` (e.g., **10%** = 0.10)
  This is the crowd's ownership immediately after the crowdfund closes.

## 1.3 Pro-rata beneficial ownership

Investors are allocated pro-rata by contribution:

* investorShareOfNominee = investedAmount / totalInvested
* investorCompanyPercentAtClose = crowdPercentAtClose * investorShareOfNominee

## 1.4 Dilution events (idiot-proof admin entry)

Admin adds later financing events that dilute existing holders.

To avoid confusing data entry, admin must choose ONE of two input methods per event:

### Method A (recommended): Enter % sold

Admin inputs:

* `percentSold` (e.g., 0.20 for 20%)
* optional `postMoneyValuationGbp` (used for "implied value")

### Method B: Enter investment + post-money valuation

Admin inputs:

* `investmentAmountGbp`
* `postMoneyValuationGbp`

System derives:

* percentSold = investmentAmountGbp / postMoneyValuationGbp

Validation:

* percentSold must be > 0 and < 1
* if both percentSold and (investment+valuation) are provided, validate they match within a small tolerance and warn if not

## 1.5 Current ownership after dilution

Let events be ordered by date. For all events after crowdfund close:

* dilutionMultiplier = Π (1 - percentSold_event)

Then:

* crowdPercentNow = crowdPercentAtClose * dilutionMultiplier
* investorPercentNow = crowdPercentNow * investorShareOfNominee

If latest event includes postMoneyValuationGbp:

* investorImpliedValueNow = investorPercentNow * postMoneyValuationGbp

---

# 2) User Experience

## 2.1 Investor (self-serve)

Investor enters email → receives magic link valid 24 hours.
After login they can view:

* their investment amount(s)
* their share of nominee pool (%)
* crowd pool ownership at close (e.g., 10%)
* their effective % of company now (after dilution)
* latest valuation snapshot (if provided) + implied value
* download **Investor Statement PDF**
* "Contact us" link (simple form)

Security:

* Do not confirm whether the email exists ("If you're on the register, you'll receive a link.")
* Rate-limit login email requests by IP/email.
* Tokens single-use, expire in 24h.

## 2.2 Admin (single account)

Admin can:

* create company profile
* create a crowdfund round record
* close the round (lock it)
* import investor list (CSV upload)
* compute pro-rata allocations and lock them
* add dilution events
* export PDFs:

  * investor statement (any investor)
  * full beneficial owner schedule PDF (all investors)
  * top-level cap table summary PDF (Nominee + post-close investors/events)

---

# 3) Core Workflows

## A) Setup

1. Admin creates `Company` (name)
2. Admin creates `CrowdfundRound`:

   * roundName
   * nomineeName
   * crowdPercentAtClose (e.g., 0.10)
   * optional metadata: platform source (GoFundMe), dates

## B) Post-close import

1. Admin marks round as `closed`
2. Admin imports investors (CSV: fullName, email, amountGbp)
3. System validates and previews totals

## C) Allocate (lock beneficial ownership)

Admin clicks "Allocate":

* compute totalInvested
* compute each investorShareOfNominee
* store allocations
* status becomes `allocated`
* allocations are immutable unless admin explicitly "reopen + reallocate" (audit logged)

## D) Add dilution events

Admin adds event via:

* Method A: percentSold (+ optional valuation)
  OR
* Method B: investmentAmount + postMoneyValuation (derive percentSold)

System recalculates:

* dilutionMultiplier
* crowdPercentNow
* each investorPercentNow
* implied values (if valuation exists)

## E) Investor statement PDF

Investor downloads:

* identification (name/email)
* round name + nominee name
* invested amount
* % of nominee pool
* effective % now
* latest valuation + implied value (if available)
* list of dilution events (date + percent sold + valuation if any)

---

# 4) Firestore Data Model (SQL-like, structured)

Use these collections:

## companies/{companyId}

* legalName
* createdAt

## rounds/{roundId}

* companyId
* roundName
* nomineeName
* status: "draft" | "closed" | "allocated"
* crowdPercentAtClose (number, e.g., 0.10)
* closeDate (timestamp)
* createdAt
* totalInvestedGbp (computed)
* allocationVersion (int)

### rounds/{roundId}/investments/{investmentId}

* investorEmail (lowercased)
* investorName
* amountGbp
* source: "GoFundMe" | "CSV" | "Manual"
* createdAt

### rounds/{roundId}/allocations/{allocationId}

* investorEmail
* investorName
* investedAmountGbpSnapshot
* shareOfNominee (number, 0..1)
* companyPercentAtClose (number)
* allocationVersion
* createdAt

## financingEvents/{eventId}

* companyId
* eventDate
* investorName (e.g., VC fund)
* inputMode: "PERCENT" | "INVESTMENT_AND_VALUATION"
* percentSold (number, 0..1)  // always stored after derivation
* investmentAmountGbp (optional)
* postMoneyValuationGbp (optional)
* createdAt

## investorProfiles/{emailHashOrId}

(avoid exposing raw emails as doc IDs; store email in fields but index by normalized email)

* email (lowercased)
* fullName (optional)
* createdAt
* lastLoginAt (optional)

## contactMessages/{messageId}

* name
* email
* message
* createdAt
* status: "new" | "read"

## auditLogs/{logId}

* actor: "admin:<email>"
* action
* entityType
* entityId
* payload
* createdAt

Indexes:

* rounds by companyId
* financingEvents by companyId ordered by eventDate
* allocations by roundId + investorEmail
* investments by roundId + investorEmail

---

# 5) Authentication & Magic Links

## Admin

* Single admin email/password
* Admin routes protected via Firebase Auth + Firestore rule checks

## Investors

* Email link sign-in (magic link)
* Link expiry: 24 hours (enforced via Firebase Auth settings + token checks)
* After login, investor can only read their own data:

  * match by authenticated email to `investments/allocations` investorEmail

---

# 6) Security Rules (high level)

* Only admin can write rounds, investments, allocations, financing events.
* Investor can read:

  * their own investments + allocations
  * public round metadata needed for statement (roundName, nomineeName)
  * financing event list (read-only) to compute dilution view
* Contact form: unauthenticated write allowed, with rate-limiting via Cloud Function endpoint.

---

# 7) Cloud Functions (API surface)

Implement callable HTTPS endpoints:

* POST /admin/importInvestors (CSV upload → parsed rows → writes investments)
* POST /admin/allocateRound (locks allocations; idempotent by allocationVersion)
* POST /admin/createFinancingEvent (accepts Method A or B, stores derived percentSold)
* GET  /investor/statementPdf (authenticated investor → returns PDF)
* GET  /admin/capTablePdf (admin only → returns PDF)
* POST /contact (stores message + optional email notify)

All functions must:

* validate inputs
* log actions to auditLogs
* be idempotent where possible

---

# 8) UI Pages (MVP)

## Public

* /
* /investor (email entry)
* /contact

## Investor (after login)

* /investor/dashboard

  * holdings summary
  * dilution-adjusted ownership
  * implied value
  * download PDF

## Admin

* /admin/login
* /admin/rounds
* /admin/rounds/:id (import + allocation + exports)
* /admin/financing-events
* /admin/exports (cap table PDF, beneficial schedule PDF)

---

# 9) Example Scenario (must show in output)

Crowdfund round:

* crowdPercentAtClose = 10%
* investors:

  * A: £10,000
  * B: £5,000
  * C: £100
  * total: £100,000 (include more in example)
    Allocations:
* shareOfNominee for each
* investorCompanyPercentAtClose

Financing event later:

* Method A: percentSold = 20%, postMoneyValuation = £25,000,000
  Show:
* crowdPercentNow = 10% * 0.8 = 8%
* investorPercentNow = 8% * shareOfNominee
* implied value = investorPercentNow * £25m

---

# 10) Output Required From You

Return:

1. MVP feature list and what's explicitly out-of-scope
2. Firestore collections + indexes
3. Firebase Auth flows
4. Cloud Functions endpoints + sample payloads
5. Dilution + allocation math (pseudocode)
6. Security rules outline
7. PDF templates outline
8. Deployment steps on Firebase free tier
