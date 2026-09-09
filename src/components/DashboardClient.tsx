"use client";

import { useCallback, useEffect, useState } from "react";
import { BusinessRevenue, DashboardPayload } from "@/types/dashboard";
import { monthFullName } from "@/lib/googleSheets/tabResolver";
import { Header } from "./Header";
import { BusinessRevenueCard } from "./BusinessRevenueCard";

// Sums only businesses that are actually connected — a disconnected
// business has no real number to add, and silently treating it as $0
// would understate the total without any indication why.
function buildTotalRevenue(businesses: BusinessRevenue[]): BusinessRevenue {
  const included = businesses.filter((b) => b.connected && b.revenueMTD !== null && b.revenueGoal !== null);
  const excluded = businesses.filter((b) => !included.includes(b));

  const revenueMTD = included.reduce((sum, b) => sum + (b.revenueMTD ?? 0), 0);
  const revenueGoal = included.reduce((sum, b) => sum + (b.revenueGoal ?? 0), 0);

  return {
    id: "total",
    name: "All Businesses",
    shortName: "Total",
    logoSrc: "",
    logoAlt: "",
    logoKind: "wordmark",
    accent: "text-amber-300",
    href: null,
    connected: included.length > 0,
    revenueMTD: included.length > 0 ? revenueMTD : null,
    revenueGoal: included.length > 0 ? revenueGoal : null,
    resolvedTab: null,
    warning:
      excluded.length > 0
        ? `Excludes ${excluded.map((b) => b.shortName).join(", ")} — not connected yet.`
        : included.length === 0
        ? "Waiting on spreadsheet access."
        : null,
  };
}

// Revenue data doesn't change second to second — 30s keeps the Sheets API
// read volume well under quota (each poll is 1 API call per business) with
// plenty of margin, even with more than one viewer/tab open at once.
const AUTO_REFRESH_INTERVAL_MS = 30000;

async function fetchDashboard(month?: string): Promise<{ payload: DashboardPayload | null; error: string | null }> {
  const url = month ? `/api/dashboard?month=${month}` : "/api/dashboard";
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!json.payload) throw new Error(json.error || "Failed to load dashboard data.");
  return json;
}

export function DashboardClient({ initial }: { initial: { payload: DashboardPayload; error: string | null } }) {
  const [state, setState] = useState(initial);

  // Live poll always fetches the current month in the background, even
  // while viewing a historical month — so "Back to Live" is instant rather
  // than needing a fresh fetch.
  const refresh = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setState(result as { payload: DashboardPayload; error: string | null });
    } catch (err) {
      setState((prev) => ({ payload: prev.payload, error: err instanceof Error ? err.message : "Refresh failed" }));
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Month selector state. viewMonth === null means "live". Picking a past
  // month fetches that tab once (historical data doesn't need polling) and
  // swaps the rendered payload without touching the live poll above.
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const [historicalPayload, setHistoricalPayload] = useState<DashboardPayload | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  const { payload: livePayload, error } = state;

  const handleSelectMonth = useCallback(
    (month: string) => {
      if (month === livePayload.liveMonth) {
        setViewMonth(null);
        return;
      }
      setViewMonth(month);
      setHistoricalLoading(true);
      setHistoricalError(null);
      fetchDashboard(month)
        .then((result) => setHistoricalPayload(result.payload))
        .catch((err) => setHistoricalError(err instanceof Error ? err.message : "Failed to load month"))
        .finally(() => setHistoricalLoading(false));
    },
    [livePayload.liveMonth]
  );

  // Only swap to the historical payload once it's actually loaded AND
  // matches the currently selected month (avoids briefly showing a stale
  // previous selection while the new one is still loading).
  const isViewingHistorical = viewMonth !== null && historicalPayload !== null && historicalPayload.selectedMonth === viewMonth;
  const payload = isViewingHistorical ? historicalPayload! : livePayload;
  const isMock = payload.businesses.some((b) => b.resolvedTab === "MOCK");

  return (
    <div className="min-h-screen w-full flex flex-col">
      <Header
        generatedAt={payload.generatedAt}
        isMock={isMock}
        selectedMonth={viewMonth ?? livePayload.liveMonth}
        liveMonth={livePayload.liveMonth}
        year={livePayload.year}
        onSelectMonth={handleSelectMonth}
      />

      {viewMonth && (
        <div className="px-6 py-1 bg-sky-500/10 border-b border-sky-500/30 text-sky-300 text-xs shrink-0 flex items-center gap-3">
          {historicalLoading ? (
            <span>Loading {monthFullName(viewMonth)}…</span>
          ) : historicalError ? (
            <span className="text-red-300">
              Failed to load {monthFullName(viewMonth)}: {historicalError} — showing live data below.
            </span>
          ) : (
            <span>Viewing {monthFullName(viewMonth)} — historical, not live.</span>
          )}
          <button type="button" onClick={() => setViewMonth(null)} className="underline hover:no-underline">
            Back to Live
          </button>
        </div>
      )}

      {error && (
        <div className="px-6 py-1 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs shrink-0">
          Showing last known data — refresh failed: {error}
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 flex flex-col gap-3 md:gap-4 w-full">
        {payload.businesses.map((business) => (
          <BusinessRevenueCard
            key={business.id}
            business={business}
            calendarProgressPct={payload.calendarProgressPct}
            socialStats={payload.socialStats[business.id]}
            socialStatsUpdatedAt={payload.socialStatsUpdatedAt}
          />
        ))}
        <div className="pt-1 mt-1 border-t border-bg-border">
          <BusinessRevenueCard
            business={buildTotalRevenue(payload.businesses)}
            calendarProgressPct={payload.calendarProgressPct}
          />
        </div>
      </main>
    </div>
  );
}
