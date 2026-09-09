// Central registry of every business shown on the master dashboard. Add a
// new business by adding an entry here (plus its spreadsheet env var) — no
// other code changes needed. A business with no spreadsheetIdEnv set (or
// missing goal/revenue cells) renders as a "not connected yet" card instead
// of erroring.

export type BusinessConfig = {
  id: string;
  name: string;
  shortName: string;
  // "image" -> logoSrc is a real logo file in /public/logos.
  // "wordmark" -> logoSrc is ignored; the name is rendered as styled text
  // until a real logo file is provided.
  logoKind: "image" | "wordmark";
  logoSrc: string;
  logoAlt: string;
  accent: string; // tailwind text color class for the wordmark placeholder
  href?: string; // optional: makes the card a link to that business's own detailed dashboard
  spreadsheetIdEnv: string;
  goalCell: string | null; // e.g. "I3" — left cell of a merged goal range. Fixed near the top of every month's tab, so this is safe to hardcode.
  // The MTD revenue cell on the TOTALS row, e.g. "H47" — but the TOTALS
  // row's exact row number shifts with days-in-month (28-31 days), so this
  // is only a reference anchor for a 31-day month. At read time the app
  // scans a small window above this row for a "TOTALS" label (see
  // revenueLabelColumn) and uses whichever row actually has it, falling
  // back to this exact cell if the label can't be confirmed.
  revenueCell: string | null;
  revenueLabelColumn?: string; // column containing the "TOTALS" row label, default "B"
  tabOverrideEnv?: string; // optional: force a specific tab name instead of auto month resolution
  tabPrefix?: string; // e.g. "Daily " for a workbook that names tabs "Daily Aug"
  tabCase?: "upper" | "title"; // "upper" -> "AUG" (default), "title" -> "Aug"
  tabYearSuffix?: "YY"; // appends " " + 2-digit year, e.g. "Daily AUG 26"
};

export const BUSINESSES: BusinessConfig[] = [
  {
    id: "ff-downtown",
    name: "Fit Factory Downtown",
    shortName: "Downtown",
    logoKind: "image",
    logoSrc: "/logos/fit-factory.png",
    logoAlt: "Fit Factory",
    accent: "text-white",
    href: "https://fit-factory-dashboard.vercel.app/",
    spreadsheetIdEnv: "GOOGLE_SHEETS_SPREADSHEET_ID_FITFACTORY",
    goalCell: "I3",
    revenueCell: "H47",
  },
  {
    id: "ff-midtown",
    name: "Fit Factory Midtown",
    shortName: "Midtown",
    logoKind: "image",
    logoSrc: "/logos/fit-factory-midtown.png",
    logoAlt: "Fit Factory Midtown",
    accent: "text-white",
    spreadsheetIdEnv: "GOOGLE_SHEETS_SPREADSHEET_ID_FITFACTORY",
    goalCell: "Q3",
    revenueCell: "H83",
  },
  {
    id: "refined-reformer",
    name: "Refined Reformer",
    shortName: "Refined Reformer",
    logoKind: "image",
    logoSrc: "/logos/refined-reformer.png",
    logoAlt: "Refined Reformer",
    accent: "text-rose-300",
    spreadsheetIdEnv: "GOOGLE_SHEETS_SPREADSHEET_ID_REFINED_REFORMER",
    goalCell: "L3",
    revenueCell: "K47",
    // This workbook names its monthly tabs "Daily AUG 26" — prefix + upper
    // month + 2-digit year, different from both other conventions.
    tabPrefix: "Daily ",
    tabYearSuffix: "YY",
  },
  {
    id: "nrg-haus",
    name: "NRG Haus",
    shortName: "NRG Haus",
    logoKind: "image",
    logoSrc: "/logos/nrg-haus.png",
    logoAlt: "NRG Haus",
    accent: "text-sky-300",
    spreadsheetIdEnv: "GOOGLE_SHEETS_SPREADSHEET_ID_NRG_HAUS",
    goalCell: "I3",
    revenueCell: "H46",
    // This workbook names its monthly tabs "Daily Aug", "Daily Sep", etc. —
    // different convention from the Fit Factory / Refined Reformer "AUG".
    tabPrefix: "Daily ",
    tabCase: "title",
  },
];
