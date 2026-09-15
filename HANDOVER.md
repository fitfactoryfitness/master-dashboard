# Handover — Master Dashboard (Cross-Business Revenue)

**In plain terms:** a TV screen showing Revenue MTD (month-to-date) for every Fit Factory
Fitness business — Fit Factory Downtown, Fit Factory Midtown, Refined Reformer, and NRG
Haus — each with its logo, stacked on one screen. Pulls automatically from four Google
Sheets, nothing to update by hand.

**Owner until 2026-09-29:** Lucas Rietsch (lucas@fitfactoryfitness.com).

## Do you need to touch any code?

**No.** This is just a web page. Nobody using it day-to-day needs to see any code.

## How to actually use it

Open this link: **https://master-dashboard-drab.vercel.app/**

No login needed — it's set up that way on purpose. Nothing to install.

*Note: the "-drab" in that address usually means Vercel couldn't use the plain name
`master-dashboard` because something else was already using it — possibly another project or
account of Lucas's. Worth a quick look in the Vercel account (see below) to make sure there
isn't a second, older version of this floating around.*

## Setting up access (do this before 2026-09-29)

### 1. Vercel (this is what actually hosts the web page)
1. Go to **vercel.com** and sign in.
2. Someone with access to the account currently hosting this needs to invite the new owner:
   click the **team/account name** (top left) → **Settings** → **Members** → **Invite Member**.
3. Enter the new owner's email, choose a role, and send the invite.
4. The new owner accepts the invite from their email — no other setup needed.

*Note: this project's Vercel account/team wasn't identifiable from the files on Lucas's
laptop — log into vercel.com to confirm which account it's under before inviting anyone.*

### 2. The Google Sheets this reads from
Reads (never writes to) four separate Google Sheets — one per business — through a shared
Google service account. Whoever becomes the technical contact should confirm that service
account still has "Viewer" access to all four sheets.

### 3. GitHub (where the code itself lives)
Nothing you need to do unless you're editing code yourself. Lucas will move this repository
into a Fit Factory GitHub organization — see the master handover plan.

## For whoever becomes the technical contact

[README.md](README.md) lists which spreadsheet and which cell feeds each business's number —
[`src/config/businesses.ts`](src/config/businesses.ts) is the one file to edit if a business
is added or a cell reference changes; nothing else in the code needs to change.
