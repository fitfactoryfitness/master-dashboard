# Fit Factory — Master Dashboard

A single-screen dashboard showing **Revenue MTD** for every Fit Factory Fitness business, stacked one below the other with each business's logo. Built on the same read-only, label-free spreadsheet approach as the [Downtown dashboard](https://github.com/lucasrfitfactory-create/fit-factory-dashboard), but pulling from four separate revenue sources instead of one.

## Businesses

| Business | Spreadsheet | Goal cell | Revenue MTD anchor | Tab convention |
|---|---|---|---|---|
| Fit Factory Downtown | `GOOGLE_SHEETS_SPREADSHEET_ID_FITFACTORY` | `I3` | `H47` | `AUG` |
| Fit Factory Midtown | `GOOGLE_SHEETS_SPREADSHEET_ID_FITFACTORY` | `Q3` | `H83` | `AUG` |
| Refined Reformer | `GOOGLE_SHEETS_SPREADSHEET_ID_REFINED_REFORMER` | `L3` | `K47` | `Daily AUG 26` |
| NRG Haus | `GOOGLE_SHEETS_SPREADSHEET_ID_NRG_HAUS` | `I3` | `H46` | `Daily Aug` |

This mapping lives in [`src/config/businesses.ts`](src/config/businesses.ts) — add a business or change a cell reference there, no other code changes needed. A business with no spreadsheet ID or cell mapping renders as a "not connected yet" card instead of erroring.

**"Revenue MTD anchor" is not a fixed cell** — it's a reference position for a 31-day month (August). The actual `TOTALS` row shifts by 1-3 rows for any 28/29/30-day month, since it always sits right after the last day-row. `src/data/provider.ts` (`readBusinessCells`) scans the label column (`revenueLabelColumn`, default `B`) in a window above the anchor row for the cell that actually says `TOTALS`, and reads revenue from that row — self-correcting for any month length. It only falls back to the literal anchor cell (with a visible warning) if that label can't be confirmed in a non-31-day month. The goal cell has no such issue — it's fixed near the top of every month's tab regardless of day count.

**Quota constraint — read this before touching `readBusinessCells` or `client.ts`.** Google's Sheets API "read requests per minute" quota counts one `batchGet` call as a single request no matter how many ranges it carries. `readBusinessCells` reads the goal cell, the TOTALS label window, and the TOTALS value window in **one** `batchGetRanges` call per business — this is deliberate, not incidental. Splitting a business's reads into multiple separate calls (as an earlier version of this code did, briefly) multiplies the quota cost and can blow through the per-minute limit under normal polling, which shows up as an intermittent "Quota exceeded" warning and revenue going blank. If a business ever needs another cell read, add it to the same `batchGetRanges` call rather than issuing a new one. There's also a warm-instance in-memory cache (`lastKnownGood` in `provider.ts`) that serves the last successful read for a business if a given request fails, so a transient quota/network error doesn't blank out a card that was working a moment ago.

Each business's monthly tab is auto-resolved from the current date via `src/lib/googleSheets/tabResolver.ts` — no hardcoded month name, so nothing needs redeploying at month rollover. Three different naming conventions are in play across the four workbooks (see table above), handled per-business via the `tabPrefix` / `tabCase` / `tabYearSuffix` fields on each entry in `src/config/businesses.ts` — add the same fields for any future business with yet another convention.

## Instagram followers & Google reviews

Each card's title line shows Instagram follower count and Google review count, sourced from [`src/config/socialStats.json`](src/config/socialStats.json) — **not** fetched live on every page load. Neither Instagram nor Google offers a simple free live API for this (Instagram's official API needs a per-account access token that expires every ~60 days; scraping on every request would be fragile and against both platforms' Terms of Service). Instead, this file is a plain data snapshot with a `generatedAt` timestamp, and the card's title has a hover tooltip noting it isn't live. Hovering the business name shows exactly when it was last checked.

To refresh it: revisit each business's Instagram profile and Google review count (search `"<business> reviews"`, read the review count off the local business panel) and update the corresponding entry, then commit. There's no automated updater wired up yet — if a recurring daily check is wanted, that would need a scheduled job (e.g. Claude Code's scheduler, or a cron-triggered script) that re-checks each source and pushes an updated `socialStats.json`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. By default `DASHBOARD_DATA_SOURCE=mock`, so it runs immediately with no Google credentials, using representative sample data (a **MOCK DATA** badge shows in the header whenever this mode is active).

## Switching to live Google Sheets data

1. In Google Cloud Console, create/select a project and enable the **Google Sheets API**.
2. Create a **Service Account** (IAM & Admin → Service Accounts) and generate a **JSON key**.
3. Share each spreadsheet above with the service account's email (`client_email` in the JSON key) as **Viewer**.
4. In `.env.local`, set `DASHBOARD_DATA_SOURCE=google`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and the `GOOGLE_SHEETS_SPREADSHEET_ID_*` variables.
5. Restart `npm run dev`.

One service account works for every business — you only need to create it once and share each new spreadsheet with the same email.

## NRG Haus

Cell mapping (`I3` goal, `H46` revenue MTD), spreadsheet ID, and logo are all configured. Only remaining step: share that spreadsheet with the service account email as **Viewer** — the card will switch from "Not connected" to live data automatically once `DASHBOARD_DATA_SOURCE=google` is set, no code changes needed.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) — this dashboard has no authentication built in yet; add access control before putting it behind a public URL.
