/**
 * Withings API access and the conversion of its measurements into
 * gewichtsdaten.json. Network calls go through the fetch passed in, so the
 * logic is testable without the API.
 */

export const AUTHORIZE_URL = 'https://account.withings.com/oauth2_user/authorize2';
export const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
export const MEASURE_URL = 'https://wbsapi.withings.net/measure';

/** Measure type "weight (kg)". */
const WEIGHT = 1;
/** Category 1 is real measurements; 2 is the user's goals. */
const REAL_MEASUREMENTS = 1;
/**
 * Attributions that surely belong to the account's user: 0 = captured by a
 * device and known to be this user, 2 = entered by the user. Left out:
 * 1 = captured by a device but possibly another user's, 4 = initial value
 * entered at account creation, and any value we do not know.
 */
const TRUSTED_ATTRIB = new Set([0, 2]);
const TIMEOUT_MS = 15_000;

export type Fetch = typeof fetch;

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  /** Unix time in seconds when the access token expires. */
  expires_at: number;
}

export interface MeasureGroup {
  grpid: number;
  attrib: number;
  /** Unix time in seconds. */
  date: number;
  category: number;
  measures: { value: number; type: number; unit: number }[];
}

export interface Measurement {
  measured_at: string;
  /** Local calendar date of the measurement, "YYYY-MM-DD". */
  date: string;
  weight_kg: number;
}

/** Shape of gewichtsdaten.json, schema_version 1. */
export interface WeightFile {
  schema_version: 1;
  /** Time of the last successful sync. */
  updated_at: string;
  timezone: string;
  measurements: Measurement[];
}

export interface Conversion {
  file: WeightFile;
  /** Weight measurements left out, counted by their attrib value. */
  skipped: Record<number, number>;
}

export class WithingsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authorizeUrl(config: Config, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: 'user.metrics',
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** Posts a form to the API and returns the body of a successful answer (status 0). */
async function call(fetchFn: Fetch, url: string, params: Record<string, string>, accessToken?: string): Promise<unknown> {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new WithingsError(response.status, `HTTP ${response.status}`);
  const json = (await response.json()) as { status: number; error?: string; body?: unknown };
  if (json.status !== 0) throw new WithingsError(json.status, json.error ?? `Withings status ${json.status}`);
  return json.body;
}

/** Exchanges an authorization code or a refresh token for new tokens. */
export async function requestToken(
  fetchFn: Fetch,
  config: Config,
  grant: { code: string } | { refresh_token: string },
  now: number,
): Promise<Tokens> {
  const body = (await call(fetchFn, TOKEN_URL, {
    action: 'requesttoken',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...('code' in grant
      ? { grant_type: 'authorization_code', code: grant.code, redirect_uri: config.redirectUri }
      : { grant_type: 'refresh_token', refresh_token: grant.refresh_token }),
  })) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Math.floor(now / 1000) + body.expires_in,
  };
}

/** All weight measurement groups of the user, following the API's pages. */
export async function fetchMeasureGroups(
  fetchFn: Fetch,
  accessToken: string,
): Promise<{ groups: MeasureGroup[]; timezone: string }> {
  const groups: MeasureGroup[] = [];
  let timezone = 'UTC';
  let offset: number | undefined;
  do {
    const body = (await call(
      fetchFn,
      MEASURE_URL,
      {
        action: 'getmeas',
        meastype: String(WEIGHT),
        category: String(REAL_MEASUREMENTS),
        ...(offset === undefined ? {} : { offset: String(offset) }),
      },
      accessToken,
    )) as { measuregrps: MeasureGroup[]; timezone?: string; more?: number | boolean; offset?: number };
    groups.push(...body.measuregrps);
    if (body.timezone) timezone = body.timezone;
    offset = body.more ? body.offset : undefined;
  } while (offset !== undefined);
  return { groups, timezone };
}

/** Calendar date of a Unix time (seconds) in the given time zone. */
export function localDate(seconds: number, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(seconds * 1000),
  );
}

/** Keeps the user's own weight measurements, oldest first. */
export function toWeightFile(groups: MeasureGroup[], timezone: string, now: Date): Conversion {
  const skipped: Record<number, number> = {};
  const measurements: { seconds: number; m: Measurement }[] = [];
  for (const group of groups) {
    const weight = group.measures.find((m) => m.type === WEIGHT);
    if (group.category !== REAL_MEASUREMENTS || !weight) continue;
    if (!TRUSTED_ATTRIB.has(group.attrib)) {
      skipped[group.attrib] = (skipped[group.attrib] ?? 0) + 1;
      continue;
    }
    measurements.push({
      seconds: group.date,
      m: {
        measured_at: new Date(group.date * 1000).toISOString(),
        date: localDate(group.date, timezone),
        // value × 10^unit kg, rounded to 10 g.
        weight_kg: Math.round(weight.value * 10 ** (weight.unit + 2)) / 100,
      },
    });
  }
  measurements.sort((a, b) => a.seconds - b.seconds);
  return {
    file: {
      schema_version: 1,
      updated_at: now.toISOString(),
      timezone,
      measurements: measurements.map((x) => x.m),
    },
    skipped,
  };
}
