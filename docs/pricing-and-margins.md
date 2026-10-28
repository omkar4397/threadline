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

## Current direction (simplified)

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
