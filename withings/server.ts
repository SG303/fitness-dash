/**
 * Optional sync service: connects one Withings account once (OAuth), then
 * writes the user's weight measurements to gewichtsdaten.json every
 * SYNC_MINUTES. Caddy forwards /withings/* here and serves the file.
 */
import { randomBytes } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import {
  WithingsError,
  authorizeUrl,
  fetchMeasureGroups,
  requestToken,
  toWeightFile,
  type Config,
  type Tokens,
} from './withings.ts';

const PORT = 8080;
const SYNC_MINUTES = 15;
/** How long a started connection may take until Withings sends the browser back. */
const LOGIN_TTL_MS = 10 * 60_000;
const TOKEN_FILE = join(process.env.STATE_DIR ?? '/state', 'tokens.json');
const OUT_FILE = join(process.env.OUT_DIR ?? '/out', 'gewichtsdaten.json');

const SKIP_REASONS: Record<number, string> = {
  1: 'von der Waage, möglicherweise von einer anderen Person',
  4: 'Startwert bei der Kontoeröffnung',
};

function readConfig(): Config {
  const { WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET, WITHINGS_REDIRECT_URI } = process.env;
  if (!WITHINGS_CLIENT_ID || !WITHINGS_CLIENT_SECRET || !WITHINGS_REDIRECT_URI) {
    console.error('Set WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET and WITHINGS_REDIRECT_URI in .env.');
    process.exit(1);
  }
  return { clientId: WITHINGS_CLIENT_ID, clientSecret: WITHINGS_CLIENT_SECRET, redirectUri: WITHINGS_REDIRECT_URI };
}

const config = readConfig();
let tokens: Tokens | null = null;
const logins = new Map<string, number>();
const status = {
  lastSync: null as string | null,
  timezone: 'UTC',
  kept: 0,
  skipped: {} as Record<number, number>,
  error: null as string | null,
};

/** Writes next to the target and renames, so readers never see half a file. */
async function writeAtomic(path: string, content: string, mode: number) {
  await writeFile(`${path}.tmp`, content, { mode });
  await rename(`${path}.tmp`, path);
}

async function loadTokens(): Promise<Tokens | null> {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, 'utf8')) as Tokens;
  } catch {
    return null;
  }
}

async function saveTokens(next: Tokens) {
  tokens = next;
  await writeAtomic(TOKEN_FILE, JSON.stringify(next), 0o600);
}

async function syncOnce() {
  if (!tokens) return;
  try {
    // Withings replaces the refresh token on every refresh; the new one is saved right away.
    if (tokens.expires_at - 60 < Date.now() / 1000) {
      await saveTokens(await requestToken(fetch, config, { refresh_token: tokens.refresh_token }, Date.now()));
    }
    const { groups, timezone } = await fetchMeasureGroups(fetch, tokens.access_token);
    const { file, skipped } = toWeightFile(groups, timezone, new Date());
    await writeAtomic(OUT_FILE, JSON.stringify(file), 0o644);
    Object.assign(status, {
      lastSync: file.updated_at,
      timezone,
      kept: file.measurements.length,
      skipped,
      error: null,
    });
    console.log(`Synced ${file.measurements.length} measurements; left out by attrib: ${JSON.stringify(skipped)}`);
  } catch (e) {
    status.error = e instanceof Error ? e.message : String(e);
    console.error(`Sync failed: ${status.error}`);
    // A rejected access token is refreshed on the next run.
    if (e instanceof WithingsError && tokens) tokens.expires_at = 0;
  }
}

let running: Promise<void> | null = null;
/** One sync at a time: two refreshes in parallel would invalidate each other's refresh token. */
function sync(): Promise<void> {
  running ??= syncOnce().finally(() => (running = null));
  return running;
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function statusPage(): string {
  const time = (iso: string) => new Date(iso).toLocaleString('de-CH', { timeZone: status.timezone });
  const skipped = Object.entries(status.skipped).map(
    ([attrib, n]) => `<li>${n} × ${escape(SKIP_REASONS[Number(attrib)] ?? `unbekannte Zuordnung (attrib ${attrib})`)}</li>`,
  );
  const lines = !tokens
    ? ['<p>Nicht verbunden.</p>']
    : [
        '<p>Verbunden.</p>',
        status.lastSync
          ? `<p>Letzter Abgleich ${time(status.lastSync)}: ${status.kept} Messungen übernommen.</p>`
          : '<p>Noch kein Abgleich.</p>',
        skipped.length ? `<p>Weggelassen:</p><ul>${skipped.join('')}</ul>` : '',
        status.error ? `<p class="error">Letzter Abgleich fehlgeschlagen: ${escape(status.error)}</p>` : '',
      ];
  return `<!doctype html>
<html lang="de-CH">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Withings – Fitness-Dash</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
  body { max-width: 34rem; margin: 0 auto; padding: 1.5rem 1rem; }
  .error { color: #c0392b; }
  a.button { display: inline-block; margin-right: 0.5rem; padding: 0.5rem 1rem; border: 1px solid; border-radius: 999px; color: inherit; font-weight: 600; text-decoration: none; }
</style>
<h1>Withings</h1>
${lines.join('\n')}
<p>Es zählen nur Messungen, die Withings sicher deinem Profil zuordnet. Ordnest du eine unsichere Messung in der Withings-App dir zu, erscheint sie beim nächsten Abgleich (alle ${SYNC_MINUTES} Minuten).</p>
<p><a class="button" href="/withings/connect">${tokens ? 'Neu verbinden' : 'Mit Withings verbinden'}</a> <a class="button" href="/">Zum Dashboard</a></p>
</html>`;
}

function send(res: ServerResponse, code: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const redirect = (res: ServerResponse, location: string) => send(res, 303, '', { Location: location });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET') return send(res, 405, '');
  try {
    switch (url.pathname) {
      case '/withings/':
        return send(res, 200, statusPage());
      case '/withings/connect': {
        const state = randomBytes(16).toString('hex');
        logins.set(state, Date.now());
        return redirect(res, authorizeUrl(config, state));
      }
      case '/withings/callback': {
        const state = url.searchParams.get('state') ?? '';
        const started = logins.get(state);
        logins.delete(state);
        if (!started || Date.now() - started > LOGIN_TTL_MS) {
          return send(res, 400, 'Anmeldung abgelaufen oder ungültig. <a href="/withings/">Zurück</a>');
        }
        const code = url.searchParams.get('code');
        if (!code) return send(res, 400, 'Zugriff nicht erteilt. <a href="/withings/">Zurück</a>');
        // The code is only valid for 30 seconds: exchange it right away.
        await saveTokens(await requestToken(fetch, config, { code }, Date.now()));
        await sync();
        return redirect(res, '/withings/');
      }
      default:
        return send(res, 404, 'Nicht gefunden.');
    }
  } catch (e) {
    console.error(e);
    return send(res, 500, `Fehler: ${escape(e instanceof Error ? e.message : String(e))} <a href="/withings/">Zurück</a>`);
  }
}).listen(PORT, () => console.log(`Listening on ${PORT}`));

tokens = await loadTokens();
void sync();
setInterval(() => void sync(), SYNC_MINUTES * 60_000);
process.on('SIGTERM', () => process.exit(0));
