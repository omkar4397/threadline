# Pricing, quotes and margins: brainstorm notes

Status: brainstorming, nothing built yet. Last updated 2026-10-28.

## Decisions so far (from the consultant)

- Keep it simple. No markup percentages.
- Track the **price quoted to the client** for each service against the **actual cost paid** to the provider (vendor, designer, printer, shipper…).
- The consultant charges a **separate coordination / consulting fee**, and also keeps **some margin on the services** they coordinate (quoted price minus actual cost).
- Quotes are per unit:
  - **Fabric**: per metre, with a free-text fabric name (silk, velvet, georgette…). No predefined list.
  - **Design**: per design.
  - **Printing**: per metre.
  - **Courier**: tracked too (unit to be decided).
- Quoted vs actual should later connect to the expenses already recorded in the app.

## Current direction: simplest version (2026-10-28)

Feedback: the linking / instalments / splits workflow felt too complicated. In most cases the vendor's quoted price is exactly what gets paid. So:

- One **Costing** table per project. A line = type (Fabric, Printing, Design, Courier, Other), name (free text for fabric, with suggestions from earlier names), quantity, **vendor rate**, **client rate**, optional vendor/designer. Margin shows as soon as both rates are typed.
- **"Mark paid"** (one tap) = paid exactly the vendor's quoted total. **"Paid a different amount"** for exceptions (and part payments, rarely needed).
- Marking paid **creates the expense automatically** (project, category, payee, amount), so vendor pages and the Expenses overview stay in sync with no double entry. (To confirm with the consultant.)
- Dropped: manual expense-to-line linking, lump-sum splitting, "fully paid" tick, separate planned/confirmed margins. One margin per line: vendor-rate based until paid, then actual paid.
- Consulting fee: one line per project, added to total earnings.
- Other spending not in the costing stays in Expenses as today.
- Open: auto-create expense OK? Courier per shipment or flat? Consulting fee always fixed?

The sections below are earlier iterations, kept for reference.

## Earlier iteration (simplified)

Each project gets a small **Quote** list. A line is: what it is, how many units, and the rate quoted to the client per unit.

| Line | Qty | Quoted rate | Quoted to client | Paid to provider | Margin |
|---|---|---|---|---|---|
| Fabric · Silk georgette | 40 m | ₹1,150/m | ₹46,000 | ₹37,381 | ₹8,619 |
| Printing | 40 m | ₹600/m | ₹24,000 | ₹22,500 | ₹1,500 |
| Designs | 3 designs | ₹5,000 | ₹15,000 | ₹12,000 | ₹3,000 |
| Courier | 2 shipments | ₹750 | ₹1,500 | ₹800 | ₹700 |
| Consulting fee | | | ₹15,000 | | ₹15,000 |

- "Paid to provider" is the sum of the project's expenses linked to that line.
- Margin = quoted to client − paid to provider. The consulting fee is shown separately and added to total earnings.
- Line types map onto the existing expense categories, each with a unit (Fabric purchase → metre, Printing & manufacturing → metre, Designer fees → design, Courier & shipping → shipment or flat).
- Fabric names are free text, with suggestions from names used before.

Open questions are tracked in the conversation; see "Questions" below.

### Two rates per line: vendor rate and client rate

How the consultant plans: ask the vendor for their rate (e.g. printing ₹500/m), then quote the client their own rate (₹600/m). So each quote line holds **both rates**:

| | Per unit | Total (× qty) | Source |
|---|---|---|---|
| Vendor's rate | ₹500/m | ₹20,000 | typed while planning |
| Client rate | ₹600/m | ₹24,000 | typed while planning |
| Paid | (derived) | ₹22,500 | sum of linked expenses |

- Planned margin = client total − vendor total (visible before any payment).
- Actual margin = client total − paid.
- Paid vs agreed shows if the vendor charged more or less than quoted.
- Expenses *are* the actuals; they link to the quote line (no separate "actual" record).
- A line can name its vendor/designer so "Record payment" pre-fills the payee.
- "Fully paid" can be suggested automatically when paid ≥ agreed vendor total; until then the summary uses the planned margin for that line.
- Lump-sum splits pre-fill from the vendor's agreed totals.
- Project summary: quoted to client · agreed with vendors · paid so far · planned margin · actual margin · consulting fee · total earnings.
- Client-facing views show client rates only.

### Instalments and lump-sum payments

One concept covers every case: a **payment (expense) can be linked to one quote line, split across several, or not linked yet**. Each quote line's "paid to provider" is the sum of the amounts linked to it.

- **Instalments for one line** (advance + balance): each instalment is its own expense linked to the same line; the line lists them and shows "paid so far".
- **Fully paid tick per line**: until ticked, the line shows "paid so far" in grey and claims no margin; once ticked, the margin is final. The project summary shows *confirmed margin* (fully paid lines) and *pending* separately, so partial payments never inflate the margin.
- **One lump sum covering several lines** (e.g. one payment to a fabric supplier for silk and velvet): "Split across quote lines" when recording the payment, pre-filled in proportion to the quoted amounts, editable, and it must add up to the payment total ("left to allocate ₹0") before saving. The payment stays a single expense on vendor pages and in the Expenses overview; only quote lines see the split.
- **Payments before the quote exists**: recorded as normal expenses, shown under "Not in quote yet", linked or split later.
- Likely data model: `quote_lines` per project, existing `expenses` unchanged as payments, plus `expense_allocations (expense_id, quote_line_id, amount)`; a single-line link is one allocation of the full amount.
- Open: confirmed vs pending margin OK? Pre-filled proportional split OK? Payments spanning two projects (suggested: record two separate payments).

## Earlier, fuller strategy (parked, for later phases)

The first proposal, kept for reference:

- **Three numbers per item**: estimated cost (what you expect to pay), client price (estimated cost + markup, or typed directly), actual cost (sum of linked expenses). Derived: planned margin, actual margin, over-budget flag.
- **Fee line with no cost**: fixed amount or a percentage of total item cost.
- **Default markups per category** in Settings, overridable per line. (Rejected for now: the consultant does not use markup.)
- **Build quote from stages**: one line per stage, pre-filled with the stage's vendor or designer.
- **Auto-linking**: when adding an expense, suggest the quote line by stage, payee and category; unlinked expenses show as "Unquoted costs" and reduce margin.
- **Privacy**: anything client-facing shows client prices only, never costs or margins.
- **Where it shows**: a "Quote & margin" section on the project page; an optional "Quote line" field on the expense form; a cross-project profitability view in the Expenses overview.
- **Phases**:
  1. Quote lines + margin tracking (core).
  2. Client-facing quote (PDF / share link, itemised or single total, approval date).
  3. Client payments / advances received, outstanding balance, cross-project profitability.
- **Complexity to avoid**: one editable quote per project (no versions); tax-exclusive amounts, with GST only on a client-facing quote if needed; several expenses (advance + balance) can link to one line.
