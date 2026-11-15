import { describe, expect, it } from 'vitest';
import {
  MEASURE_URL,
  TOKEN_URL,
  WithingsError,
  authorizeUrl,
  fetchMeasureGroups,
  localDate,
  requestToken,
  toWeightFile,
  type Fetch,
  type MeasureGroup,
} from './withings.ts';

const config = { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://dash.example.com/withings/callback' };

/** A fetch that answers with the given bodies in turn and records the requests. */
function fakeFetch(...answers: unknown[]) {
  const requests: { url: string; params: URLSearchParams; auth: string | undefined }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    requests.push({
      url,
      params: init.body as URLSearchParams,
      auth: (init.headers as Record<string, string>).Authorization,
    });
    return new Response(JSON.stringify(answers.shift()));
  }) as Fetch;
  return { fn, requests };
}

function group(date: string, kg: number, attrib = 0, extra: Partial<MeasureGroup> = {}): MeasureGroup {
  return {
    grpid: Date.parse(date),
    attrib,
    date: Date.parse(date) / 1000,
    category: 1,
    measures: [{ value: Math.round(kg * 1000), type: 1, unit: -3 }],
    ...extra,
  };
}

describe('authorizeUrl', () => {
  it('asks for the metrics scope with the registered callback and the state', () => {
    const url = new URL(authorizeUrl(config, 'abc'));
    expect(url.origin + url.pathname).toBe('https://account.withings.com/oauth2_user/authorize2');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'id',
      scope: 'user.metrics',
      redirect_uri: config.redirectUri,
      state: 'abc',
    });
  });
});

describe('requestToken', () => {
  it('exchanges a code and computes the expiry', async () => {
    const { fn, requests } = fakeFetch({
      status: 0,
      body: { access_token: 'a', refresh_token: 'r', expires_in: 10800 },
    });
    const tokens = await requestToken(fn, config, { code: 'c' }, 1_000_000_000_000);
    expect(tokens).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: 1_000_010_800 });
    expect(requests[0].url).toBe(TOKEN_URL);
    expect(Object.fromEntries(requests[0].params)).toMatchObject({
      action: 'requesttoken',
      grant_type: 'authorization_code',
      code: 'c',
      redirect_uri: config.redirectUri,
      client_secret: 'secret',
    });
  });

  it('refreshes with the refresh token', async () => {
    const { fn, requests } = fakeFetch({ status: 0, body: { access_token: 'a2', refresh_token: 'r2', expires_in: 10800 } });
    await requestToken(fn, config, { refresh_token: 'r' }, 0);
    expect(Object.fromEntries(requests[0].params)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'r' });
  });

  it('throws the Withings status of a failed call', async () => {
    const { fn } = fakeFetch({ status: 503, error: 'Invalid params' });
    await expect(requestToken(fn, config, { code: 'c' }, 0)).rejects.toEqual(new WithingsError(503, 'Invalid params'));
  });
});

describe('fetchMeasureGroups', () => {
  it('follows the pages with the bearer token', async () => {
    const { fn, requests } = fakeFetch(
      { status: 0, body: { measuregrps: [group('2026-11-01T06:00:00Z', 80)], timezone: 'Europe/Zurich', more: 1, offset: 1 } },
      { status: 0, body: { measuregrps: [group('2026-11-02T06:00:00Z', 81)], timezone: 'Europe/Zurich', more: 0 } },
    );
    const { groups, timezone } = await fetchMeasureGroups(fn, 'token');
    expect(groups).toHaveLength(2);
    expect(timezone).toBe('Europe/Zurich');
    expect(requests.map((r) => r.url)).toEqual([MEASURE_URL, MEASURE_URL]);
    expect(requests[0].auth).toBe('Bearer token');
    expect(Object.fromEntries(requests[0].params)).toEqual({ action: 'getmeas', meastype: '1', category: '1' });
    expect(requests[1].params.get('offset')).toBe('1');
  });
});

describe('localDate', () => {
  it('uses the local day, not the UTC day', () => {
    expect(localDate(Date.parse('2026-11-14T23:30:00Z') / 1000, 'Europe/Zurich')).toBe('2026-11-15');
    expect(localDate(Date.parse('2026-11-14T23:30:00Z') / 1000, 'UTC')).toBe('2026-11-14');
  });
});

describe('toWeightFile', () => {
  const now = new Date('2026-11-15T08:00:00Z');

  it('converts value and unit to kg and sorts oldest first', () => {
    const { file } = toWeightFile(
      [group('2026-11-03T06:00:00Z', 82.45), { ...group('2026-11-02T06:00:00Z', 0), measures: [{ value: 824, type: 1, unit: -1 }] }],
      'Europe/Zurich',
      now,
    );
    expect(file).toEqual({
      schema_version: 1,
      updated_at: '2026-11-15T08:00:00.000Z',
      timezone: 'Europe/Zurich',
      measurements: [
        { measured_at: '2026-11-02T06:00:00.000Z', date: '2026-11-02', weight_kg: 82.4 },
        { measured_at: '2026-11-03T06:00:00.000Z', date: '2026-11-03', weight_kg: 82.45 },
      ],
    });
  });

  it('keeps device and manual measurements of the user and counts the others', () => {
    const { file, skipped } = toWeightFile(
      [
        group('2026-11-01T06:00:00Z', 80, 0),
        group('2026-11-02T06:00:00Z', 62, 1),
        group('2026-11-03T06:00:00Z', 81, 2),
        group('2026-11-04T06:00:00Z', 90, 4),
        group('2026-11-05T06:00:00Z', 63, 1),
        group('2026-11-06T06:00:00Z', 70, 9),
      ],
      'UTC',
      now,
    );
    expect(file.measurements.map((m) => m.weight_kg)).toEqual([80, 81]);
    expect(skipped).toEqual({ 1: 2, 4: 1, 9: 1 });
  });

  it('ignores goals and groups without a weight', () => {
    const { file, skipped } = toWeightFile(
      [
        group('2026-11-01T06:00:00Z', 75, 0, { category: 2 }),
        { ...group('2026-11-02T06:00:00Z', 0), measures: [{ value: 20, type: 6, unit: 0 }] },
      ],
      'UTC',
      now,
    );
    expect(file.measurements).toEqual([]);
    expect(skipped).toEqual({});
  });
});
