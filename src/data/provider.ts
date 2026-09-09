import { BUSINESSES, BusinessConfig } from "@/config/businesses";
import { batchGetRanges, listTabNames } from "@/lib/googleSheets/client";
import { currentMonthTabName, MONTH_ABBR, monthFullName, resolveTab, titleCaseMonth, twoDigitYear } from "@/lib/googleSheets/tabResolver";
import { parseCurrency } from "@/lib/spreadsheetParser/valueParsing";
import { BusinessRevenue, DashboardPayload, SocialStats } from "@/types/dashboard";
import socialStatsData from "@/config/socialStats.json";

const TIMEZONE = process.env.BUSINESS_TIMEZONE || "America/Toronto";

function calendarProgressPct(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value); // 1-12
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (day / daysInMonth) * 100;
}

function daysInMonthForAbbr(monthAbbr: string, year: number): number {
  const idx = MONTH_ABBR.indexOf(monthAbbr); // 0-based
  return new Date(Date.UTC(year, idx + 1, 0)).getUTCDate();
}

function parseCellRef(cell: string): { col: string; row: number } {
  const match = cell.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: "${cell}"`);
  return { col: match[1].toUpperCase(), row: Number(match[2]) };
}

const MOCK_REVENUE: Record<string, { revenueMTD: number; revenueGoal: number }> = {
  "ff-downtown": { revenueMTD: 72394, revenueGoal: 90000 },
  "ff-midtown": { revenueMTD: 55064, revenueGoal: 55000 },
  "refined-reformer": { revenueMTD: 38210, revenueGoal: 52000 },
  "nrg-haus": { revenueMTD: 0, revenueGoal: 0 },
};

// Warm-instance cache of the last successfully read value per business per
// month — Vercel functions reuse a warm instance across nearby requests, so
// this absorbs most of a transient Sheets API failure (quota, network blip)
// by serving the last good read instead of flashing "Not connected". It's
// not guaranteed to survive a cold start, but that's an acceptable gap: a
// cold start already means a fresh attempt at a real read.
type CachedBusiness = { data: BusinessRevenue; cachedAt: number };
const lastKnownGood = new Map<string, CachedBusiness>();

// Builds this business's tab name for a given month/year using its own
// naming convention (tabPrefix/tabCase/tabYearSuffix), the same formula
// used for the live month — so picking a past month from the selector
// resolves correctly per-business, not just for the "AUG" convention.
function tabNameForMonth(business: BusinessConfig, monthAbbr: string, year: number): string {
  const formattedMonth = business.tabCase === "title" ? titleCaseMonth(monthAbbr) : monthAbbr;
  const yearSuffix = business.tabYearSuffix === "YY" ? ` ${twoDigitYear(year)}` : "";
  return `${business.tabPrefix ?? ""}${formattedMonth}${yearSuffix}`;
}

// Reads the goal cell and the MTD revenue figure for one business/tab in a
// SINGLE batchGet call. This matters for quota, not just speed: Google's
// Sheets API "read requests per minute" quota counts one batchGet as one
// request no matter how many ranges it carries, so every range this
// business needs must be requested together — splitting it into separate
// calls (as an earlier version of this function did) multiplies the quota
// cost per business and is what caused live polling to start hitting
// "Quota exceeded" errors.
//
// The revenue figure specifically comes from the sheet's own TOTALS row,
// whose exact row number shifts with days-in-month (28-31 days) — so
// business.revenueCell is only a reliable anchor for a 31-day month. This
// scans the label column (default "B") in a small window ending at the
// anchor row for a cell reading "TOTALS", and reads revenue from whichever
// row actually has it — self-correcting for any month length. It only
// falls back to the literal anchor cell (with a warning) if that label
// can't be confirmed in a non-31-day month, where the anchor may be wrong.
async function readBusinessCells(
  spreadsheetId: string,
  tab: string,
  business: BusinessConfig,
  monthAbbr: string,
  year: number
): Promise<{ goalRaw: string | undefined; revenueRaw: string | undefined; warning?: string }> {
  const { col: revCol, row: anchorRow } = parseCellRef(business.revenueCell!);
  const labelCol = business.revenueLabelColumn ?? "B";
  const windowStart = Math.max(1, anchorRow - 3);

  const [goalCells, labelCells, valueCells] = await batchGetRanges(spreadsheetId, [
    `${tab}!${business.goalCell}`,
    `${tab}!${labelCol}${windowStart}:${labelCol}${anchorRow}`,
    `${tab}!${revCol}${windowStart}:${revCol}${anchorRow}`,
  ]);

  const offset = labelCells.findIndex((c) => (c ?? "").trim().toUpperCase() === "TOTALS");
  if (offset >= 0) {
    return { goalRaw: goalCells[0], revenueRaw: valueCells[offset] };
  }

  const anchorOffset = anchorRow - windowStart;
  const days = daysInMonthForAbbr(monthAbbr, year);
  const warning =
    days !== 31
      ? `Could not confirm the TOTALS row for "${tab}" (expected near ${revCol}${anchorRow}) — showing that row directly, which may be off since this month has ${days} days.`
      : undefined;
  return { goalRaw: goalCells[0], revenueRaw: valueCells[anchorOffset], warning };
}

async function fetchLiveBusinessRevenue(business: BusinessConfig, monthAbbr: string, year: number): Promise<BusinessRevenue> {
  const base = {
    id: business.id,
    name: business.name,
    shortName: business.shortName,
    logoSrc: business.logoSrc,
    logoAlt: business.logoAlt,
    logoKind: business.logoKind,
    accent: business.accent,
    href: business.href ?? null,
  };

  const spreadsheetId = process.env[business.spreadsheetIdEnv];
  if (!spreadsheetId || !business.goalCell || !business.revenueCell) {
    return {
      ...base,
      connected: false,
      revenueMTD: null,
      revenueGoal: null,
      resolvedTab: null,
      warning: "Not connected yet — spreadsheet ID or cell mapping missing.",
    };
  }

  const cacheKey = `${business.id}:${monthAbbr}:${year}`;
  const defaultTab = tabNameForMonth(business, monthAbbr, year);
  const requestedTab = business.tabOverrideEnv && process.env[business.tabOverrideEnv]
    ? (process.env[business.tabOverrideEnv] as string)
    : defaultTab;

  try {
    let tab = requestedTab;
    let tabWarning: string | undefined;
    let cells;
    try {
      cells = await readBusinessCells(spreadsheetId, tab, business, monthAbbr, year);
    } catch {
      // Requested tab likely doesn't exist yet — resolve against the real tab list.
      const availableTabs = await listTabNames(spreadsheetId);
      const resolution = resolveTab(requestedTab, availableTabs);
      tab = resolution.resolvedTab;
      tabWarning = resolution.warning;
      cells = await readBusinessCells(spreadsheetId, tab, business, monthAbbr, year);
    }

    const goal = parseCurrency(cells.goalRaw);
    const revenue = parseCurrency(cells.revenueRaw);

    const result: BusinessRevenue = {
      ...base,
      connected: true,
      revenueMTD: revenue.value,
      revenueGoal: goal.value,
      resolvedTab: tab,
      warning: tabWarning || cells.warning || goal.warning || revenue.warning || null,
    };
    lastKnownGood.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read spreadsheet.";
    const cached = lastKnownGood.get(cacheKey);
    if (cached) {
      const ageMin = Math.round((Date.now() - cached.cachedAt) / 60000);
      return {
        ...cached.data,
        warning: `Showing last known data (${ageMin < 1 ? "under a minute" : `${ageMin} min`} old) — refresh failed: ${message}`,
      };
    }
    return {
      ...base,
      connected: false,
      revenueMTD: null,
      revenueGoal: null,
      resolvedTab: null,
      warning: message,
    };
  }
}

function mockBusinessRevenue(business: BusinessConfig): BusinessRevenue {
  const mock = MOCK_REVENUE[business.id];
  const connected = Boolean(mock && mock.revenueGoal > 0);
  return {
    id: business.id,
    name: business.name,
    shortName: business.shortName,
    logoSrc: business.logoSrc,
    logoAlt: business.logoAlt,
    logoKind: business.logoKind,
    accent: business.accent,
    href: business.href ?? null,
    connected,
    revenueMTD: connected ? mock.revenueMTD : null,
    revenueGoal: connected ? mock.revenueGoal : null,
    resolvedTab: connected ? "MOCK" : null,
    warning: connected ? null : "Not connected yet — spreadsheet ID or cell mapping missing.",
  };
}

// overrideMonth: a 3-letter month abbreviation (e.g. "JUL") to view a past
// month instead of the live current one, from the month selector. A closed
// past month has nothing left to "pace" against, so calendarProgressPct is
// forced to 100 — see RevenueHero-equivalent status math in
// computePaceStatus, which otherwise compares progress to elapsed-time.
export async function fetchDashboard(now: Date, overrideMonth?: string): Promise<DashboardPayload> {
  const isMock = (process.env.DASHBOARD_DATA_SOURCE || "mock") === "mock";
  const live = currentMonthTabName(now, TIMEZONE);
  const monthAbbr = overrideMonth ?? live.tab;
  const isHistorical = monthAbbr !== live.tab;

  const businesses = isMock
    ? BUSINESSES.map(mockBusinessRevenue)
    : await Promise.all(BUSINESSES.map((b) => fetchLiveBusinessRevenue(b, monthAbbr, live.year)));

  return {
    generatedAt: now.toISOString(),
    calendarProgressPct: isHistorical ? 100 : calendarProgressPct(now, TIMEZONE),
    monthLabel: `${monthFullName(monthAbbr)} ${live.year}`,
    businesses,
    socialStats: socialStatsData.stats as Record<string, SocialStats | undefined>,
    socialStatsUpdatedAt: socialStatsData.generatedAt,
    selectedMonth: monthAbbr,
    liveMonth: live.tab,
    year: live.year,
    isHistorical,
  };
}
