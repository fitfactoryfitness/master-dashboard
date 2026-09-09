import { google } from "googleapis";

// Server-side only. Never import this module from a client component.
// Credentials are read from environment variables and never sent to the browser.

export type SheetGrid = string[][];

let sheetsClientPromise: ReturnType<typeof buildClient> | null = null;

async function buildClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY. Set DASHBOARD_DATA_SOURCE=mock to run without Google credentials."
    );
  }
  // Normalize the private key defensively — it reaches this code through
  // several different paste/storage paths (.env file, Vercel's env var UI,
  // copy/paste through a terminal or chat), any of which can mangle line
  // endings in ways that produce a cryptic OpenSSL "DECODER routines::
  // unsupported" error instead of a clear one.
  let privateKey = rawKey.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  try {
    const { createPrivateKey } = await import("crypto");
    createPrivateKey(privateKey);
  } catch (err) {
    throw new Error(
      `GOOGLE_PRIVATE_KEY does not parse as a valid PEM private key after normalization (${
        err instanceof Error ? err.message : String(err)
      }). Re-copy it from the service account JSON key file directly into the env var, without extra quoting.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

async function getClient() {
  if (!sheetsClientPromise) sheetsClientPromise = buildClient();
  return sheetsClientPromise;
}

export async function listTabNames(spreadsheetId: string): Promise<string[]> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

// Reads any set of A1 ranges in ONE network round trip — critical for quota:
// Google's Sheets API "read requests per minute" quota counts one
// batchGet call as a single request no matter how many ranges it carries,
// so every caller in this app MUST fold all the ranges it needs for one
// business into a single batchGetRanges call rather than making separate
// calls per range. Each returned array holds every cell in that range in
// row-major order (a single-cell range comes back as a 1-element array).
export async function batchGetRanges(
  spreadsheetId: string,
  ranges: string[]
): Promise<(string | undefined)[][]> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.valueRanges || []).map((vr) => (vr.values || []).map((row) => row?.[0] as string | undefined));
}
