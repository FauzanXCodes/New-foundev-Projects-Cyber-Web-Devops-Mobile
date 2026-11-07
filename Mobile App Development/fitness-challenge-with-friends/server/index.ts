// Zero-dependency API for the friends test. Run with `npm run api` (Node 23.6+ runs .ts directly).
import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isDate, localDate } from '../shared/catalog.ts';
import {
  applyFlairs,
  deleteChallenge, syncSteps, updateWorkout, workoutLog,
  acceptInvite, agreeConsequence, canView, challengeById, checkinFor, createChallenge, detailFor, endEarly,
  addCrew, friendFor, postTalk, setShared, homeFor, houseFor, inviteByToken, inviteFor, invitePreview, isActive, join, logCheckin, meFor,
  meView, memberOf, proposeConsequence, renameLoser, requestRemoval, resetName, settle, signin, signup, undoCheckin, updateMe,
} from './logic.ts';
import { appSiteAssociation, invitePage, privacyPage } from './preview.ts';
import { DATA_FILE, HttpError, load, save } from './store.ts';
import type { Challenge, DB, User } from './store.ts';

type Ctx = { db: DB; today: string; user: User; body: any; params: Record<string, string> };
type OpenCtx = Omit<Ctx, 'user'> & { user: User | null };
type Route = { method: string; path: string[]; auth: boolean; run: (ctx: any) => unknown };

const routes: Route[] = [];
const open = (method: string, path: string, run: (ctx: OpenCtx) => unknown) =>
  routes.push({ method, path: path.split('/').filter(Boolean), auth: false, run });
const route = (method: string, path: string, run: (ctx: Ctx) => unknown) =>
  routes.push({ method, path: path.split('/').filter(Boolean), auth: true, run });

// `latestBuild` is the newest build testers can install. An older app uses it to say an update is ready.
open('GET', '/api/health', () => ({ ok: true, latestBuild: Number(process.env.LATEST_BUILD ?? 0) }));
open('POST', '/api/signup', ({ db, today, body }) => signup(db, today, body));
open('POST', '/api/signin', ({ db, body }) => signin(db, body));
open('GET', '/api/invites/:token', ({ db, today, user, params }) => invitePreview(db, inviteByToken(db, params.token), user, today));

route('GET', '/api/me', ({ user }) => meView(user));
route('PATCH', '/api/me', ({ db, user, body }) => updateMe(db, user, body));
route('POST', '/api/me/name/reset', ({ db, user }) => resetName(db, user));
route('GET', '/api/home', ({ db, user, today }) => homeFor(db, user, today));
route('GET', '/api/me/summary', ({ db, user, today }) => meFor(db, user, today));
route('GET', '/api/crew/:id', ({ db, user, params }) => friendFor(db, user, params.id));
route('POST', '/api/crew/invite', ({ db, user }) => ({ token: inviteFor(db, user, null) }));
route('GET', '/api/checkin', ({ db, user, today }) => checkinFor(db, user, today));
route('POST', '/api/checkin', ({ db, user, today, body }) => logCheckin(db, user, today, body));
route('POST', '/api/checkin/undo', ({ db, user, today, body }) => undoCheckin(db, user, today, body));
route('GET', '/api/house', ({ db, user, today }) => houseFor(db, user, today));
route('GET', '/api/workouts', ({ db, user }) => workoutLog(db, user));
route('PATCH', '/api/workouts/:id', ({ db, user, params, body }) => updateWorkout(db, user, params.id, body));
route('POST', '/api/steps', ({ db, user, today, body }) => syncSteps(db, user, today, body));
route('POST', '/api/challenges', ({ db, user, today, body }) => createChallenge(db, user, today, body));
route('POST', '/api/invites/:token/accept', ({ db, user, today, params }) => ({
  challengeId: acceptInvite(db, inviteByToken(db, params.token), user, today),
}));
route('POST', '/api/challenges/:id/invite', ({ db, user, today, params }) => {
  const ch = challengeById(db, params.id);
  if (!isActive(ch, memberOf(db, ch, user.id), today)) throw new HttpError(403, "You're not in this challenge.");
  return { token: inviteFor(db, user, ch.id) };
});

// Every challenge action answers with the refreshed challenge, so the screen re-renders in one trip.
function challengeRoute(method: string, suffix: string, act?: (ctx: Ctx, ch: Challenge) => void) {
  route(method, `/api/challenges/:id${suffix}`, (ctx) => {
    const ch = challengeById(ctx.db, ctx.params.id);
    if (!canView(ctx.db, ch, ctx.user, ctx.today)) throw new HttpError(404, 'Challenge not found.');
    act?.(ctx, ch);
    return detailFor(ctx.db, ch, ctx.user, ctx.today);
  });
}
challengeRoute('GET', '');
challengeRoute('POST', '/join', ({ db, user, today }, ch) => {
  // Reaching this far means it is an open challenge, or a shared one a friend of theirs is in.
  if (!ch.houseChallenge && !ch.shared) throw new HttpError(403, 'Join this one from an invite link.');
  join(db, ch, user, today);
});
challengeRoute('POST', '/consequence', ({ db, user, today, body }, ch) => proposeConsequence(db, ch, user, today, body));
challengeRoute('POST', '/consequence/agree', ({ db, user, today }, ch) => agreeConsequence(db, ch, user, today));
challengeRoute('POST', '/rename', ({ db, user, today, body }, ch) => renameLoser(db, ch, user, today, body));
challengeRoute('POST', '/removals', ({ db, user, today, body }, ch) => requestRemoval(db, ch, user, today, body));
challengeRoute('POST', '/talk', ({ db, user, today, body }, ch) => postTalk(db, ch, user, today, body));
challengeRoute('POST', '/share', ({ db, user, body }, ch) => setShared(db, ch, user, body));
challengeRoute('POST', '/add', ({ db, user, today, body }, ch) => addCrew(db, ch, user, today, body));
challengeRoute('POST', '/end', ({ db, user, today }, ch) => endEarly(db, ch, user, today));
route('POST', '/api/challenges/:id/delete', ({ db, user, params }) => {
  deleteChallenge(db, challengeById(db, params.id), user);
  return { ok: true };
});

function match(method: string, pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.path.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = r.path.every((seg, i) => {
      if (!seg.startsWith(':')) return seg === parts[i];
      params[seg.slice(1)] = decodeURIComponent(parts[i]);
      return true;
    });
    if (ok) return { r, params };
  }
  return null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Today',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new HttpError(413, 'Too much data.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Bad request.');
  }
}

const PORT = Number(process.env.PORT ?? 8787);

// ---------- pages for links opened outside the app ----------
// These are not JSON and need no sign-in: they are what Messages, a browser or iOS itself fetches.

const ICON_FILE = new URL('../assets/icon.png', import.meta.url);
const origin = (req: IncomingMessage) =>
  process.env.PUBLIC_URL?.replace(/\/$/, '') ?? `${req.headers['x-forwarded-proto'] ?? 'http'}://${req.headers.host}`;

function page(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...CORS });
  res.end(body);
}

/** Returns true when it handled the request. */
function servePublic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (req.method !== 'GET') return false;

  const invite = pathname.match(/^\/invite\/([\w-]+)$/);
  if (invite) {
    try {
      const db = load();
      const preview = invitePreview(db, inviteByToken(db, invite[1]), null, localDate());
      page(res, 200, 'text/html; charset=utf-8', invitePage(preview, {
        base: origin(req),
        token: invite[1],
        scheme: process.env.APP_SCHEME ?? 'fitchallenge',
        installUrl: process.env.INSTALL_URL,
      }));
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Something went wrong.';
      page(res, err instanceof HttpError ? err.status : 500, 'text/plain; charset=utf-8', message);
    }
    return true;
  }

  if (pathname === '/privacy') {
    page(res, 200, 'text/html; charset=utf-8', privacyPage(process.env.CONTACT_EMAIL));
    return true;
  }

  if (pathname === '/invite-image.png') {
    page(res, 200, 'image/png', readFileSync(ICON_FILE));
    return true;
  }

  if (pathname === '/.well-known/apple-app-site-association') {
    const file = appSiteAssociation(process.env.APPLE_TEAM_ID, process.env.BUNDLE_ID ?? 'com.jean.fitnesschallenge');
    if (file) page(res, 200, 'application/json', JSON.stringify(file));
    else page(res, 404, 'text/plain; charset=utf-8', 'Set APPLE_TEAM_ID to publish the universal links association.');
    return true;
  }
  return false;
}

const server = http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (servePublic(req, res, pathname)) return;
    try {
      const found = match(req.method ?? 'GET', pathname);
      if (!found) throw new HttpError(404, 'Not found.');
      const body = req.method === 'GET' ? {} : await readBody(req);
      const header = req.headers['x-today'];
      const today = isDate(header) ? header : localDate();
      const db = load();
      const settled = settle(db, today);
      applyFlairs(db, today);
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      const user = (token && db.users.find((u) => u.token === token)) || null;
      if (found.r.auth && !user) throw new HttpError(401, 'Please sign in again.');
      const result = found.r.run({ db, today, user, body, params: found.params });
      if (settled || req.method !== 'GET') save(db);
      send(res, 200, result);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Something went wrong. Try again.' });
    }
  })
  .listen(PORT, '0.0.0.0', () => console.log(`API on http://localhost:${PORT}  data: ${DATA_FILE}`));

// Node closes an idle connection after 5 seconds. A phone that reuses one just as it closes gets a
// dropped request, which shows up as a screen that occasionally hangs for no reason. Hold them open
// longer than any client will (and the header timeout just past that, as Node requires).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
