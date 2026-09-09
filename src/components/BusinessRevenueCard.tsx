"use client";

import Image from "next/image";
import { fmtCurrency, STATUS_COLORS } from "@/lib/format";
import { computePaceStatus, badgeTextForPaceStatus } from "@/lib/calculations/status";
import { BusinessRevenue, SocialStats } from "@/types/dashboard";
import { ProgressBar } from "./ProgressBar";

export function BusinessRevenueCard({
  business,
  calendarProgressPct,
  socialStats,
  socialStatsUpdatedAt,
}: {
  business: BusinessRevenue;
  calendarProgressPct: number;
  socialStats?: SocialStats;
  socialStatsUpdatedAt?: string | null;
}) {
  const hasGoal = business.revenueGoal !== null;
  const pct =
    business.revenueMTD !== null && business.revenueGoal !== null && business.revenueGoal > 0
      ? (business.revenueMTD / business.revenueGoal) * 100
      : null;
  const status = business.connected && hasGoal ? computePaceStatus(pct, calendarProgressPct) : "unavailable";
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unavailable;
  const badgeText = !business.connected ? "Not connected" : !hasGoal ? "No goal set" : badgeTextForPaceStatus(status, pct);

  const CardTag = business.href ? "a" : "div";
  const linkProps = business.href ? { href: business.href, target: "_blank", rel: "noopener noreferrer" } : {};

  const reviewsFmt = socialStats ? socialStats.googleReviews.toLocaleString("en-CA") : null;
  const statsAsOf =
    socialStats && socialStatsUpdatedAt
      ? `Instagram/Google stats as of ${new Date(socialStatsUpdatedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} — not live.`
      : undefined;

  const badge = (
    <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs md:text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {badgeText}
    </span>
  );

  // Logo files in /public/logos are pre-cropped to their visible content —
  // plain object-contain fits each one's real aspect ratio into whatever
  // box it's placed in, whether that's the small mobile chip or the larger
  // desktop panel.
  const logo =
    business.logoKind === "image" ? (
      <Image src={business.logoSrc} alt={business.logoAlt} fill sizes="160px" className="object-contain" />
    ) : (
      <span className={`text-[8px] sm:text-lg md:text-2xl font-black uppercase text-center leading-tight break-words ${business.accent}`}>
        {business.shortName}
      </span>
    );

  const moneyBlock = (
    <div className="flex items-baseline gap-2 md:gap-3 min-w-0 flex-wrap">
      <span className="text-3xl md:text-5xl font-black text-white leading-none tracking-tight truncate">
        {business.connected ? fmtCurrency(business.revenueMTD) : "—"}
      </span>
      {business.connected && hasGoal && (
        <span className="text-lg md:text-2xl text-slate-400 font-semibold shrink-0"> / {fmtCurrency(business.revenueGoal)}</span>
      )}
    </div>
  );

  const progressBlock = !business.connected ? (
    <p className="text-sm text-slate-500">{business.warning || "Waiting on spreadsheet access."}</p>
  ) : !hasGoal ? (
    <p className="text-sm text-slate-500">No goal set for this month yet.{business.warning ? ` ${business.warning}` : ""}</p>
  ) : (
    <div className="flex flex-col gap-1.5">
      <ProgressBar currentPct={pct} expectedPct={calendarProgressPct} status={status} height="h-3 md:h-4" />
      <div className="flex justify-between text-xs md:text-sm">
        <span className="text-slate-300 font-semibold">{pct !== null ? `${pct.toFixed(1)}% achieved` : "—"}</span>
        <span className="text-slate-400">{calendarProgressPct.toFixed(1)}% of month elapsed</span>
      </div>
      {business.warning && <p className="text-xs text-slate-500">{business.warning}</p>}
    </div>
  );

  const statsBlock = socialStats && (
    <div className="flex flex-row sm:flex-col gap-4 sm:gap-2 justify-between sm:justify-center h-full">
      <div>
        <div className="text-slate-500 text-[10px] md:text-xs uppercase tracking-wide font-semibold">Instagram</div>
        <div className="text-slate-200 text-sm md:text-base font-bold">{socialStats.instagramFollowers} Followers</div>
      </div>
      <div>
        <div className="text-slate-500 text-[10px] md:text-xs uppercase tracking-wide font-semibold">Google</div>
        <div className="text-slate-200 text-sm md:text-base font-bold">{reviewsFmt} Reviews</div>
      </div>
    </div>
  );

  return (
    <CardTag
      {...linkProps}
      className={`rounded-2xl border border-bg-border border-l-4 ${colors.border} bg-bg-card shadow-lg shadow-black/20 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 md:gap-6 ${
        business.href ? "transition-colors hover:bg-white/5 cursor-pointer" : ""
      }`}
    >
      {/* Mobile (<640px): compact header — small logo chip + name + badge,
          since there's no room for a full logo panel plus a 75/25 split. */}
      <div className="flex sm:hidden flex-col gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center bg-white/5 rounded-lg p-1.5">{logo}</div>
          <h2 className="text-slate-100 text-sm font-bold uppercase tracking-wide truncate" title={statsAsOf}>
            {business.shortName}
          </h2>
          {business.href && <span className="text-slate-500 shrink-0">↗</span>}
        </div>
        <div>{badge}</div>
      </div>

      {/* Tablet/desktop (640px+): logo panel on the left. */}
      <div className="relative hidden sm:flex items-center justify-center sm:w-24 md:w-32 sm:h-12 md:h-16 shrink-0">{logo}</div>

      {/* Content: name/revenue/progress (75%) + Instagram/Google stats (25%) on sm+, stacked on mobile. */}
      <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 min-w-0">
        <div className="w-full sm:w-3/4 flex flex-col gap-2 sm:gap-2.5 min-w-0">
          <div className="hidden sm:flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-slate-300 text-sm md:text-lg font-bold uppercase tracking-wide truncate" title={statsAsOf}>
              {business.name}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {business.href && <span className="text-slate-500">↗</span>}
              {badge}
            </div>
          </div>
          {moneyBlock}
          {progressBlock}
        </div>

        {statsBlock && (
          <div
            className="w-full sm:w-1/4 pt-3 border-t border-bg-border sm:pt-0 sm:border-t-0 sm:border-l sm:pl-4 md:pl-6 shrink-0"
            title={statsAsOf}
          >
            {statsBlock}
          </div>
        )}
      </div>
    </CardTag>
  );
}
