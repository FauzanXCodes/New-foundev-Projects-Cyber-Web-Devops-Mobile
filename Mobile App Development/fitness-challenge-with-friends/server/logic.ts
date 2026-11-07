import {
  ACTIVITIES, METRICS, REWARD_DAYS, WEEKDAYS, shortDate, STAKES, TIMES, TRACK_TYPES, TYPES, addDays, daysLeftText, diffDays, fairPlay, fmt, forfeitDays, isBand, longDate, mondayOf,
  periodWord, personalTarget, rangeText, targetOptions, targetShort, targetText, unit, WORKOUTS, metricText, workoutKind,
} from '../shared/catalog.ts';
import type { Activity, Band, TrackType } from '../shared/catalog.ts';
import { CODE_ALPHABET, RENAME_DAYS, cleanLastName, isRenameConsequence, offLimitsReason } from '../shared/copy.ts';
import type {
  Achievement, Stakes,
  ChallengeCard, ChallengeDetail, CheckinData, CheckinResult, ConsequenceView, FriendData, HomeData,
  HouseCard, InvitePreview, Me, MeData, Medal, PastRow, Person, RenameView, SignupResult, Workout,
} from '../shared/api.ts';
import { HttpError, activeRenames, applyRenames, hashPin, isPin, newId, normalizePhone, nowIso, verifyPin } from './store.ts';
import { randomInt } from 'node:crypto';
import type { Challenge, DB, Invite, Member, User, WorkoutDetail } from './store.ts';

// ---------- lookups ----------

export const person = (u: User): Person => ({
  id: u.id, name: u.name, avatar: u.avatar,
  flair: u.flair ? { emoji: u.flair.emoji, kind: u.flair.kind } : null,
});

/** What a challenge puts on the line, themed to its type. */
export function stakesFor(ch: Pick<Challenge, 'type' | 'houseChallenge'>): Stakes {
  const s = STAKES[ch.type];
  return {
    reward: { ...s.reward, days: REWARD_DAYS },
    forfeit: { ...s.forfeit, days: forfeitDays(ch.houseChallenge) },
    solo: ch.houseChallenge,
  };
}

/**
 * Puts today's badge on everyone who is wearing one, in memory only, so every view that shows a person
 * shows it without knowing where it came from. If someone holds more than one, the newest wins.
 */
export function applyFlairs(db: DB, today: string): void {
  for (const u of db.users) delete u.flair;
  const active = db.flairs.filter((f) => f.from <= today && today < f.until).sort((a, b) => a.from.localeCompare(b.from));
  for (const f of active) {
    const u = db.users.find((x) => x.id === f.userId);
    const ch = db.challenges.find((c) => c.id === f.challengeId);
    if (!u || !ch) continue;
    const badge = STAKES[ch.type][f.kind];
    u.flair = { emoji: badge.emoji, title: badge.title, kind: f.kind, challengeName: ch.name, until: f.until };
  }
}

function award(db: DB, ch: Challenge, userId: string, kind: 'reward' | 'forfeit', today: string): void {
  const days = kind === 'reward' ? REWARD_DAYS : forfeitDays(ch.houseChallenge);
  db.flairs.push({ userId, challengeId: ch.id, kind, from: today, until: addDays(today, days) });
}

export const meView = (u: User): Me => ({
  ...person(u), workoutTime: u.workoutTime, trackedTypes: u.trackedTypes, notifications: u.notifications,
  band: u.band, phone: u.phone, hasPin: !!u.pinHash, nameChange: u.nameChange ?? null,
  flairDetail: u.flair ?? null,
});

const userById = (db: DB, id: string | null) => db.users.find((u) => u.id === id);

export function challengeById(db: DB, id: string): Challenge {
  const ch = db.challenges.find((c) => c.id === id);
  if (!ch) throw new HttpError(404, 'Challenge not found.');
  return ch;
}

export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Latest membership row. House challenges can be rejoined, so a user may have several. */
export function memberOf(db: DB, ch: Challenge, userId: string | undefined): Member | undefined {
  let found: Member | undefined;
  for (const m of db.members) {
    if (m.challengeId === ch.id && m.userId === userId && (!found || m.joinedAt > found.joinedAt)) found = m;
  }
  return found;
}

/** One row per person who has not been removed. */
function roster(db: DB, ch: Challenge): Member[] {
  const latest = new Map<string, Member>();
  for (const m of db.members) {
    if (m.challengeId !== ch.id) continue;
    const prev = latest.get(m.userId);
    if (!prev || m.joinedAt > prev.joinedAt) latest.set(m.userId, m);
  }
  return [...latest.values()].filter((m) => !m.removedAt);
}

export function windowOf(ch: Challenge, m: Member) {
  if (ch.houseChallenge) return { start: m.joinedDate, end: addDays(m.joinedDate, ch.lengthDays) };
  return { start: ch.startAt, end: ch.endAt };
}

export function isActive(ch: Challenge, m: Member | undefined, today: string): m is Member {
  return !!m && !m.removedAt && !m.result && ch.status !== 'done' && today < windowOf(ch, m).end;
}

/** Who shows up in cards and standings. House challenges only show people currently in. */
function people(db: DB, ch: Challenge, today: string, viewerId?: string): Member[] {
  const all = roster(db, ch);
  return ch.houseChallenge ? all.filter((m) => m.userId === viewerId || isActive(ch, m, today)) : all;
}

function statusOf(db: DB, ch: Challenge): Challenge['status'] {
  if (ch.status === 'done') return 'done';
  if (ch.houseChallenge) return 'live';
  return roster(db, ch).length >= 2 ? 'live' : 'waiting';
}

function activeFor(db: DB, user: User, today: string) {
  return db.challenges
    .map((ch) => ({ ch, m: memberOf(db, ch, user.id) }))
    .filter((x): x is { ch: Challenge; m: Member } => isActive(x.ch, x.m, today))
    .sort((a, b) => b.m.joinedAt.localeCompare(a.m.joinedAt));
}

// ---------- scoring ----------
// Each period (a day or a week) earns credit up to the target, so extra sessions in one week
// can't cover a missed one. A "total" challenge is a single period and a race to the target.

type Progress = {
  /** This person's own number for one period. Everyone shares it unless fair play is on. */
  target: number;
  credit: number;
  total: number;
  current: number;
  complete: boolean;
  periodDone: boolean;
  finishedAt: string | null;
  lastLog: string | null;
  loggedToday: boolean;
};

const periodLen = (ch: Challenge) => (ch.per === 'day' ? 1 : ch.per === 'week' ? 7 : ch.lengthDays);
const periodCount = (ch: Challenge) => (ch.per === 'total' ? 1 : Math.ceil(ch.lengthDays / periodLen(ch)));

/** Everyone plays to their own number in a fair play challenge, the crew's number otherwise. */
export function targetFor(db: DB, ch: Challenge, userId: string): number {
  const band: Band = userById(db, userId)?.band ?? 'active';
  return personalTarget(ch.type, ch.target, band, ch.houseChallenge);
}

/** How much of your own goal you have done. This is what standings rank on. */
const share = (p: Progress) => (p.total > 0 ? p.credit / p.total : 0);

/** `asOf` replays the challenge as it stood on an earlier day, for last week's ranking. */
function progressOf(db: DB, ch: Challenge, m: Member, today: string, asOf = today): Progress {
  const { start, end } = windowOf(ch, m);
  const target = targetFor(db, ch, m.userId);
  const len = periodLen(ch);
  const count = periodCount(ch);
  const sums = new Array<number>(count).fill(0);
  const total = target * count;
  const logs = db.logs
    .filter((l) => l.challengeId === ch.id && l.userId === m.userId && l.date >= start && l.date < end && l.date <= asOf)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let credit = 0;
  let finishedAt: string | null = null;
  let lastLog: string | null = null;
  for (const l of logs) {
    const i = Math.floor(diffDays(l.date, start) / len);
    const before = Math.min(sums[i], target);
    sums[i] += l.amount;
    credit += Math.min(sums[i], target) - before;
    if (!finishedAt && credit >= total) finishedAt = l.createdAt;
    if (!lastLog || l.date > lastLog) lastLog = l.date;
  }
  const now = Math.min(count - 1, Math.max(0, Math.floor(diffDays(today, start) / len)));
  const current = ch.per === 'total' ? credit : sums[now];
  return {
    target, credit, total, current, finishedAt, lastLog,
    complete: credit >= total,
    periodDone: current >= target,
    loggedToday: logs.some((l) => l.date === today),
  };
}

function progressText(ch: Challenge, p: Progress): string {
  const numeric = TYPES[ch.type].numeric;
  if (ch.per === 'total') return `${fmt(p.credit)} of ${fmt(p.target)} ${unit(ch.type, p.target)}`;
  return `${fmt(p.current)} of ${fmt(p.target)}${numeric ? ` ${unit(ch.type, p.target)}` : ''} ${periodWord(ch.per)}`;
}

/**
 * Standard competition ranking on percent of your own goal, so 1, 1, 3 for a tie at the top.
 */
function ranksOf(rows: { id: string; share: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  let rank = 0;
  let prev = NaN;
  [...rows].sort((a, b) => b.share - a.share).forEach((r, i) => {
    if (r.share !== prev) {
      rank = i + 1;
      prev = r.share;
    }
    out.set(r.id, rank);
  });
  return out;
}

function finish(db: DB, ch: Challenge, today: string): void {
  ch.status = 'done';
  const rows = roster(db, ch).filter((m) => !m.result).map((m) => ({ m, p: progressOf(db, ch, m, today) }));
  const winners = new Set<string>();
  if (rows.length >= 2) {
    if (ch.per === 'total') {
      const first = rows.filter((r) => r.p.finishedAt).sort((a, b) => a.p.finishedAt!.localeCompare(b.p.finishedAt!))[0];
      if (first) winners.add(first.m.userId);
    } else {
      const best = Math.max(...rows.map((r) => share(r.p)));
      const top = rows.filter((r) => share(r.p) === best);
      if (best > 0 && top.length < rows.length) top.forEach((r) => winners.add(r.m.userId));
    }
  }
  for (const r of rows) r.m.result = winners.has(r.m.userId) ? 'won' : 'finished';

  // The stakes: only when there was a real contest with a winner. The winners wear the reward, and
  // whoever came last without reaching the goal wears the forfeit.
  if (winners.size) {
    const lowest = Math.min(...rows.map((r) => share(r.p)));
    for (const r of rows) {
      if (winners.has(r.m.userId)) award(db, ch, r.m.userId, 'reward', today);
      else if (share(r.p) === lowest && !r.p.complete) award(db, ch, r.m.userId, 'forfeit', today);
    }
  }
}

/** Applies anything that became due since the last request: removals and finished challenges. */
export function settle(db: DB, today: string, now = Date.now()): boolean {
  let changed = false;
  for (const r of db.removals) {
    if (r.resolved) continue;
    const ch = db.challenges.find((c) => c.id === r.challengeId);
    const m = ch && memberOf(db, ch, r.userId);
    const loggedSince = db.logs.some((l) => l.challengeId === r.challengeId && l.userId === r.userId && l.createdAt > r.requestedAt);
    if (!ch || !isActive(ch, m, today) || loggedSince) {
      r.resolved = 'cancelled';
      changed = true;
    } else if (now - Date.parse(r.requestedAt) >= 86400000) {
      m.removedAt = new Date(now).toISOString();
      m.result = 'dropped';
      r.resolved = 'removed';
      changed = true;
    }
  }
  for (const ch of db.challenges) {
    if (ch.houseChallenge) {
      for (const m of db.members) {
        if (m.challengeId === ch.id && !m.result && !m.removedAt && today >= windowOf(ch, m).end) {
          m.result = 'finished';
          // An open challenge has no opponents: the stakes ride on whether you reached the goal.
          award(db, ch, m.userId, progressOf(db, ch, m, today).complete ? 'reward' : 'forfeit', today);
          changed = true;
        }
      }
    } else if (ch.status !== 'done' && today >= ch.endAt) {
      finish(db, ch, today);
      changed = true;
    }
  }
  return changed;
}

function streaks(db: DB, userId: string, today: string) {
  const days = new Set(db.logs.filter((l) => l.userId === userId && l.date <= today && !l.auto).map((l) => l.date));
  let current = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

// ---------- views ----------

function cardFor(db: DB, ch: Challenge, m: Member, today: string): ChallengeCard {
  const p = progressOf(db, ch, m, today);
  const status = statusOf(db, ch);
  const who = people(db, ch, today).map((x) => userById(db, x.userId)).filter((u): u is User => !!u);
  return {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    mine: !ch.houseChallenge && ch.creatorId === m.userId,
    targetShort: targetShort(ch),
    progressText: progressText(ch, p),
    fraction: Math.min(1, p.current / p.target),
    periodDone: p.periodDone,
    complete: p.complete,
    members: who.slice(0, 5).map(person),
    memberCount: who.length,
    daysLeftText: daysLeftText(diffDays(windowOf(ch, m).end, today)),
    waiting: status === 'waiting',
    live: status === 'live',
    ...(m.addedBy ? { addedBy: userById(db, m.addedBy)?.name ?? 'A friend' } : {}),
  };
}

export function homeFor(db: DB, user: User, today: string): HomeData {
  const crew = db.crew
    .filter((c) => c.userId === user.id)
    .map((c) => userById(db, c.friendUserId))
    .filter((u): u is User => !!u)
    .map((f) => ({ ...person(f), loggedToday: db.logs.some((l) => l.userId === f.id && l.date === today) }));
  return {
    user: meView(user), crew, challenges: activeFor(db, user, today).map(({ ch, m }) => cardFor(db, ch, m, today)),
    suggested: suggestionsFor(db, user, today),
  };
}

const crewIds = (db: DB, userId: string) => db.crew.filter((c) => c.userId === userId).map((c) => c.friendUserId);

/** Whether someone outside a challenge may see and join it: open ones always, shared ones through a friend who is in. */
function reachable(db: DB, ch: Challenge, user: User, today: string): boolean {
  if (ch.houseChallenge) return true;
  if (!ch.shared || ch.status === 'done') return false;
  const friends = crewIds(db, user.id);
  return roster(db, ch).some((m) => friends.includes(m.userId) && isActive(ch, m, today));
}

/**
 * Challenges worth offering: only ones somebody in your crew is already in. Nothing is recommended to
 * someone whose friends are not in anything, so the first thing a newcomer sees is never a stranger's list.
 */
function suggestionsFor(db: DB, user: User, today: string): Suggestion[] {
  const friends = crewIds(db, user.id);
  if (!friends.length) return [];
  return db.challenges
    .filter((ch) => ch.status !== 'done' && today < ch.endAt && (ch.houseChallenge || ch.shared) && !isActive(ch, memberOf(db, ch, user.id), today))
    .map((ch) => {
      const inIt = roster(db, ch).filter((m) => isActive(ch, m, today));
      const mine = inIt.filter((m) => friends.includes(m.userId)).map((m) => userById(db, m.userId)).filter((u): u is User => !!u);
      return { id: ch.id, name: ch.name, type: ch.type, targetText: targetText(ch), friends: mine.map(person), memberCount: inIt.length };
    })
    .filter((s) => s.friends.length)
    .sort((a, b) => b.friends.length - a.friends.length)
    .slice(0, 5);
}

// ---------- per-person facts, the timeline, and talk ----------

/** Each day's amount for one person in one challenge, keyed by date. Sessions count as 1. */
function dailyOf(db: DB, ch: Challenge, userId: string): Map<string, number> {
  const days = new Map<string, number>();
  for (const l of db.logs) {
    if (l.challengeId !== ch.id || l.userId !== userId) continue;
    days.set(l.date, (days.get(l.date) ?? 0) + l.amount);
  }
  return days;
}

/**
 * One true, specific thing about how someone is going. There are usually several to choose from, and
 * which one shows moves on each day, so the standings read differently as the challenge goes.
 */
function factFor(db: DB, ch: Challenge, m: Member, today: string, isYou: boolean): string | null {
  const numeric = TYPES[ch.type].numeric;
  const days = dailyOf(db, ch, m.userId);
  const { start } = windowOf(ch, m);
  const who = isYou ? 'You' : (userById(db, m.userId)?.name.split(' ')[0] ?? 'They');
  const have = isYou ? 'have' : 'has';
  const facts: string[] = [];

  // A run of days in a row, counted back from today (or yesterday, if today is still open).
  let run = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) run++;
  if (run >= 2) facts.push(`${run} days in a row`);

  const logged = [...days.entries()].filter(([d]) => d >= start && d <= today);
  const since = diffDays(today, start) + 1;
  if (since >= 3 && logged.length === since) facts.push(`${who} ${have}n't missed a day yet`);

  if (numeric && logged.length) {
    const [bestDay, best] = logged.reduce((a, b) => (b[1] > a[1] ? b : a));
    facts.push(`Best day: ${fmt(best)} ${unit(ch.type, best)} on ${bestDay === today ? 'today' : WEEKDAYS[new Date(bestDay + 'T00:00:00Z').getUTCDay()]}`);
    const t = days.get(today) ?? 0, y = days.get(addDays(today, -1)) ?? 0;
    if (t > 0 && y > 0 && t !== y) facts.push(`${t > y ? 'Up' : 'Down'} ${fmt(Math.abs(t - y))} ${unit(ch.type, Math.abs(t - y))} on yesterday`);
    if (logged.length >= 3) {
      const avg = logged.reduce((sum, [, v]) => sum + v, 0) / logged.length;
      facts.push(`Averaging ${fmt(ch.type === 'steps' ? Math.round(avg / 100) * 100 : avg)} ${unit(ch.type, avg)} a day`);
    }
  }

  // Across everything they have logged, not just this challenge.
  const all = db.logs.filter((l) => l.userId === m.userId && !l.auto);
  const allDays = [...new Set(all.map((l) => l.date))];
  if (allDays.length >= 4) {
    const byWeekday = new Array<number>(7).fill(0);
    for (const d of allDays) byWeekday[new Date(d + 'T00:00:00Z').getUTCDay()]++;
    const top = byWeekday.indexOf(Math.max(...byWeekday));
    if (byWeekday[top] >= 2 && byWeekday.filter((n) => n === byWeekday[top]).length === 1) facts.push(`Shows up most on ${WEEKDAYS[top]}s`);
    const weekend = byWeekday[0] + byWeekday[6];
    if (weekend / allDays.length >= 0.6) facts.push('A weekend warrior');
  }
  // What they do most, from workouts they chose to share (or any of your own).
  const kinds = new Map<string, number>();
  for (const w of db.workouts) {
    if (w.userId !== m.userId || !w.workout || !(isYou || w.shared)) continue;
    kinds.set(w.workout, (kinds.get(w.workout) ?? 0) + 1);
  }
  const fav = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0];
  if (fav && fav[1] >= 2) facts.push(`Go-to workout: ${workoutKind(fav[0])?.label.toLowerCase()}`);

  const firstToday = db.logs.filter((l) => l.challengeId === ch.id && l.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (firstToday?.userId === m.userId && roster(db, ch).length >= 2) facts.push('First one in today');

  const last = logged.map(([d]) => d).sort().pop();
  if (!facts.length) {
    if (!last) return since >= 2 ? 'Yet to get on the board' : null;
    const quiet = diffDays(today, last);
    return quiet >= 2 ? `Quiet for ${quiet} days` : null;
  }
  let seed = diffDays(today, start);
  for (const c of m.userId) seed += c.charCodeAt(0);
  return facts[seed % facts.length];
}

/** Your own days in the challenge so far, with how today compares. */
function timelineFor(db: DB, ch: Challenge, m: Member, today: string): Timeline {
  const numeric = TYPES[ch.type].numeric;
  const days = dailyOf(db, ch, m.userId);
  const { start, end } = windowOf(ch, m);
  const target = targetFor(db, ch, m.userId);
  const out: Timeline['days'] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    out.push({ date: d, label: WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()][0], amount: d > today ? 0 : days.get(d) ?? 0, today: d === today, future: d > today });
  }
  const past = out.filter((d) => !d.future);
  const t = days.get(today) ?? 0, y = days.get(addDays(today, -1)) ?? 0;
  let trend: Timeline['trend'] = null;
  let trendText: string | null = null;
  if (numeric && past.length >= 2) {
    trend = t > y ? 'up' : t < y ? 'down' : 'flat';
    trendText = t === y ? 'Same as yesterday' : `${fmt(Math.abs(t - y))} ${unit(ch.type, Math.abs(t - y))} ${t > y ? 'more' : 'fewer'} than yesterday`;
  } else if (!numeric && past.length >= 2) {
    const week = past.slice(-7).filter((d) => d.amount > 0).length;
    const before = past.slice(-14, -7).filter((d) => d.amount > 0).length;
    trend = past.length > 7 ? (week > before ? 'up' : week < before ? 'down' : 'flat') : null;
    trendText = `${week} of the last ${Math.min(7, past.length)} days`;
  }
  const best = past.reduce((a, b) => (b.amount > a.amount ? b : a), past[0]);
  return {
    unit: TYPES[ch.type].many,
    pace: !numeric ? null : ch.per === 'day' ? target : ch.per === 'week' ? Math.round((target / 7) * 10) / 10 : Math.round((target / ch.lengthDays) * 10) / 10,
    days: out,
    trend,
    trendText,
    bestText: numeric && best && best.amount > 0 ? `Best: ${fmt(best.amount)} on ${shortDate(best.date)}` : null,
    goalText: targetShort({ ...ch, target }),
  };
}

function talkFor(db: DB, ch: Challenge, viewerId: string | undefined, today: string): TalkLine[] {
  return db.messages
    .filter((x) => x.challengeId === ch.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-40)
    .flatMap((x) => {
      const u = userById(db, x.userId);
      if (!u) return [];
      const day = x.createdAt.slice(0, 10);
      return [{ ...person(u), lineId: x.id, text: x.text, mine: u.id === viewerId, when: day === today ? 'Today' : shortDate(day) }];
    });
}

/** Say something to everyone in a challenge. Only for people in it. */
export function postTalk(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireMember(db, ch, user, today);
  const text = cleanText(body?.text, 160);
  if (!text) throw new HttpError(400, 'Say something first.');
  db.messages.push({ id: newId(), challengeId: ch.id, userId: user.id, text, createdAt: nowIso() });
  // Kept short: it is banter, not an archive.
  const mine = db.messages.filter((x) => x.challengeId === ch.id);
  if (mine.length > 200) db.messages = db.messages.filter((x) => x.challengeId !== ch.id || mine.indexOf(x) >= mine.length - 200);
}

/** Whoever started a challenge decides whether their friends' crews can see and join it. */
export function setShared(db: DB, ch: Challenge, user: User, body: any): void {
  if (ch.houseChallenge || ch.creatorId !== user.id) throw new HttpError(403, 'Only the person who started this can do that.');
  ch.shared = body?.shared === true;
}

export function friendFor(db: DB, viewer: User, friendId: string): FriendData {
  const inCrew = db.crew.some((c) => c.userId === viewer.id && c.friendUserId === friendId);
  const friend = userById(db, friendId);
  if (!inCrew || !friend) throw new HttpError(404, 'Not in your crew.');
  const rows = db.members.filter((m) => m.userId === friendId && (m.result === 'won' || m.result === 'finished'));
  const wins = rows
    .filter((m) => m.result === 'won')
    .map((m) => ({ ch: challengeById(db, m.challengeId), size: roster(db, challengeById(db, m.challengeId)).length }))
    .sort((a, b) => b.size - a.size || b.ch.endAt.localeCompare(a.ch.endAt));
  return {
    ...person(friend), completed: rows.length, biggestWin: wins[0]?.ch.name ?? null,
    recent: workoutsOf(db, friendId).filter((w) => w.shared).slice(0, 5),
  };
}

/** The medals for things done across challenges. Each is worked out from what is already recorded. */
function achievementsFor(db: DB, user: User, today: string, longestStreak: number): Achievement[] {
  const mine = db.logs.filter((l) => l.userId === user.id);
  const typed = mine.filter((l) => !l.auto);
  const workouts = new Set(typed.map((l) => l.checkinId)).size;
  const activities = new Set(typed.map((l) => l.activity)).size;
  const rows = db.members.filter((m) => m.userId === user.id);
  const wins = rows.filter((m) => m.result === 'won').length;
  const goals = rows.filter((m) => {
    const ch = db.challenges.find((c) => c.id === m.challengeId);
    return !!ch && medalFor(db, ch, m, today) !== null;
  }).length;
  const crew = db.crew.filter((c) => c.userId === user.id).length;
  const detailed = db.workouts.filter((w) => w.userId === user.id && (w.minutes || w.note || w.exercises.length)).length;
  // The most steps in one day in any single challenge (a day's steps can sit in several challenges at once).
  const stepDays = new Map<string, number>();
  for (const l of mine) if (l.type === 'steps') stepDays.set(`${l.challengeId}:${l.date}`, (stepDays.get(`${l.challengeId}:${l.date}`) ?? 0) + l.amount);
  const bestSteps = Math.max(0, ...stepDays.values());
  const led = db.challenges.filter((c) => c.creatorId === user.id && roster(db, c).length >= 2).length;
  const forfeits = db.flairs.filter((f) => f.userId === user.id && f.kind === 'forfeit').length;

  const count = (id: string, emoji: string, title: string, text: string, have: number, need: number, noun: string, gold = false): Achievement => ({
    id, emoji, title, text, gold,
    earned: have >= need,
    progress: Math.min(1, have / need),
    progressText: have >= need ? 'Earned' : `${fmt(Math.min(have, need))} of ${fmt(need)} ${noun}`,
  });
  return [
    count('first', '👣', 'First step', 'Log your first workout.', workouts, 1, 'workouts'),
    count('w10', '🔟', 'Ten down', 'Log 10 workouts.', workouts, 10, 'workouts'),
    count('w50', '🎯', 'Fifty', 'Log 50 workouts.', workouts, 50, 'workouts'),
    count('w100', '💯', 'Century', 'Log 100 workouts.', workouts, 100, 'workouts', true),
    count('s3', '🎩', 'Hat trick', 'Log three days in a row.', longestStreak, 3, 'days'),
    count('s7', '📅', 'Full week', 'Log seven days in a row.', longestStreak, 7, 'days'),
    count('s30', '🔥', 'Unstoppable', 'Log thirty days in a row.', longestStreak, 30, 'days', true),
    count('goal1', '🏁', 'Finisher', 'Reach your goal in a challenge.', goals, 1, 'challenges'),
    count('goal5', '🎖️', 'Regular', 'Reach your goal in five challenges.', goals, 5, 'challenges'),
    count('win1', '🏆', 'Champion', 'Win a challenge.', wins, 1, 'wins'),
    count('win3', '👑', 'Dynasty', 'Win three challenges.', wins, 3, 'wins', true),
    count('crew3', '👯', 'Good company', 'Have three people in your crew.', crew, 3, 'people'),
    count('lead', '📣', 'Ringleader', 'Start a challenge that someone else joins.', led, 1, 'challenges'),
    count('steps', '👟', 'Ten thousand', 'Walk 10,000 steps in a day in a steps challenge.', bestSteps, 10000, 'steps'),
    count('variety', '🤹', 'All-rounder', 'Log four different kinds of workout.', activities, 4, 'kinds'),
    count('notes', '📒', 'Bookkeeper', 'Add details to a workout.', detailed, 1, 'workouts'),
    count('sport', '🤝', 'Good sport', 'Wear a forfeit badge and take it well.', forfeits, 1, 'forfeits'),
  ];
}

export function meFor(db: DB, user: User, today: string): MeData {
  const { current, longest } = streaks(db, user.id, today);
  const rows = db.members.filter((m) => m.userId === user.id);
  const monday = mondayOf(today);
  const todayIndex = diffDays(today, monday);

  // One check-in can count toward several challenges; group rows so nothing is counted twice.
  const checkins = new Map<string, typeof db.logs>();
  for (const l of db.logs) {
    if (l.userId !== user.id || l.date < monday || l.date > today) continue;
    checkins.set(l.checkinId, [...(checkins.get(l.checkinId) ?? []), l]);
  }
  const tracked = user.trackedTypes.map((type) => {
    const days = new Array<number>(7).fill(0);
    for (const group of checkins.values()) {
      const i = diffDays(group[0].date, monday);
      if (type === 'steps' || type === 'miles') {
        days[i] += Math.max(0, ...group.filter((l) => l.type === type).map((l) => l.amount));
      } else if (!group[0].auto && ACTIVITIES.find((a) => a.key === group[0].activity)?.tracks === type) {
        days[i] += 1;
      }
    }
    const total = days.reduce((a, b) => a + b, 0);
    return {
      type,
      label: TYPES[type].label,
      totalText: `${fmt(total)} this week`,
      days: days.map((v, i) => (i > todayIndex ? null : v)),
      todayIndex,
    };
  });

  const past: (PastRow & { end: string })[] = [];
  for (const m of rows) {
    if (!m.result && !m.removedAt) continue;
    const ch = challengeById(db, m.challengeId);
    const w = windowOf(ch, m);
    const result = m.result === 'won' ? 'Won' : m.result === 'finished' ? 'Finished' : 'Dropped';
    past.push({ id: ch.id, name: ch.name, type: ch.type, rangeText: rangeText(w.start, w.end), result, medal: medalFor(db, ch, m, today), end: w.end });
  }
  past.sort((a, b) => b.end.localeCompare(a.end));

  return {
    user: meView(user),
    achievements: achievementsFor(db, user, today, longest),
    streak: current,
    longestStreak: longest,
    completed: rows.filter((m) => m.result === 'won' || m.result === 'finished').length,
    won: rows.filter((m) => m.result === 'won').length,
    tracked,
    past: past.map(({ end, ...row }) => row),
  };
}

/** Gold for winning. A goal medal for reaching your own goal by the end. Nothing while it is still running. */
function medalFor(db: DB, ch: Challenge, m: Member, today: string): Medal | null {
  if (!m.result || m.result === 'dropped') return null;
  if (m.result === 'won') return 'gold';
  return progressOf(db, ch, m, today).complete ? 'goal' : null;
}

// ---------- workout details and the workout log ----------

const whole = (v: unknown, max: number): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
};

/** What someone typed about a workout, tidied. Null when there is nothing worth keeping. */
function cleanDetail(raw: any): Omit<WorkoutDetail, 'id' | 'userId'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .slice(0, 20)
    .map((e: any) => {
      const weight = Math.round(Number(e?.weight) * 10) / 10;
      return {
        name: cleanText(e?.name, 40),
        sets: whole(e?.sets, 99),
        reps: whole(e?.reps, 999),
        weight: Number.isFinite(weight) && weight > 0 && weight <= 2000 ? weight : null,
      };
    })
    .filter((e: { name: string }) => e.name);
  const kind = workoutKind(raw.workout);
  const n = kind ? Number(raw.amount) : NaN;
  const info = kind ? METRICS[kind.metric] : null;
  const amount = info && n > 0 && n <= info.max ? (info.whole ? Math.round(n) : Math.round(n * 100) / 100) : null;
  let minutes = whole(raw.minutes, 1440);
  // A workout measured in minutes says how long it took, so the two never disagree.
  if (kind?.metric === 'min' && amount) minutes = amount;
  const detail = { minutes, note: cleanText(raw.note, 280), exercises, shared: raw.shared === true, workout: kind?.key ?? null, amount };
  return detail.minutes || detail.note || exercises.length || detail.shared || detail.workout ? detail : null;
}

/** Everything one person has logged, newest first: each check-in once, with its detail if it has any. */
function workoutsOf(db: DB, userId: string): Workout[] {
  const groups = new Map<string, typeof db.logs>();
  for (const l of db.logs) {
    if (l.userId !== userId || l.auto) continue;
    groups.set(l.checkinId, [...(groups.get(l.checkinId) ?? []), l]);
  }
  return [...groups.entries()]
    .map(([id, logs]) => {
      const d = db.workouts.find((w) => w.id === id && w.userId === userId);
      const first = logs[0];
      return {
        id,
        date: first.date,
        dateText: longDate(first.date),
        activity: first.activity,
        activityLabel: ACTIVITIES.find((a) => a.key === first.activity)?.label ?? 'Workout',
        kind: workoutKind(d?.workout)?.label ?? null,
        kindEmoji: workoutKind(d?.workout)?.emoji ?? null,
        metricText: d?.amount && workoutKind(d.workout) ? metricText(workoutKind(d.workout)!.metric, d.amount) : null,
        minutes: d?.minutes ?? null,
        note: d?.note ?? '',
        exercises: d?.exercises ?? [],
        shared: d?.shared ?? false,
        countedToward: logs
          .map((l) => db.challenges.find((c) => c.id === l.challengeId)?.name)
          .filter((n): n is string => !!n),
        at: first.createdAt,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
    .map(({ at, ...w }) => w);
}

export const workoutLog = (db: DB, user: User): Workout[] => workoutsOf(db, user.id).slice(0, 200);

/** Add or change the detail on one of your own workouts, any day. */
export function updateWorkout(db: DB, user: User, id: string, body: any): Workout {
  if (!db.logs.some((l) => l.checkinId === id && l.userId === user.id && !l.auto)) throw new HttpError(404, 'Workout not found.');
  const detail = cleanDetail(body) ?? { minutes: null, note: '', exercises: [], shared: false };
  // Editing the details later does not ask which workout it was again, so that part is kept as it was.
  const old = db.workouts.find((w) => w.id === id && w.userId === user.id);
  if (body?.workout === undefined && old?.workout) Object.assign(detail, { workout: old.workout, amount: old.amount ?? null });
  db.workouts = db.workouts.filter((w) => !(w.id === id && w.userId === user.id));
  db.workouts.push({ id, userId: user.id, ...detail });
  return workoutsOf(db, user.id).find((w) => w.id === id)!;
}

// ---------- steps from the phone ----------

/**
 * The phone reports today's step count; it becomes today's number in every steps challenge this person
 * is in. One synced log per challenge per day, rewritten as the count climbs. Steps someone typed in by
 * hand that day are kept, and the synced log only covers the difference, so nothing is counted twice.
 * These logs do not count as a check-in: walking around is not the same as saying you worked out.
 */
export function syncSteps(db: DB, user: User, today: string, body: any): { challenges: number; steps: number } {
  const steps = Math.round(Number(body?.steps));
  if (!(steps >= 0 && steps <= 200000)) throw new HttpError(400, 'That step count does not look right.');
  let challenges = 0;
  for (const { ch } of activeFor(db, user, today)) {
    if (ch.type !== 'steps') continue;
    const mine = (l: DB['logs'][number]) => l.challengeId === ch.id && l.userId === user.id && l.date === today;
    const typed = db.logs.filter((l) => mine(l) && !l.auto).reduce((sum, l) => sum + l.amount, 0);
    const amount = Math.max(0, steps - typed);
    const existing = db.logs.find((l) => mine(l) && l.auto);
    if (existing) existing.amount = amount;
    else if (amount > 0) {
      db.logs.push({
        id: newId(), checkinId: `steps:${today}:${user.id}`, userId: user.id, challengeId: ch.id, date: today,
        activity: 'walk', type: 'steps', amount, createdAt: nowIso(), auto: true,
      });
    }
    challenges++;
  }
  return { challenges, steps };
}

export function checkinFor(db: DB, user: User, today: string): CheckinData {
  return {
    checkedIn: db.logs.some((l) => l.userId === user.id && l.date === today && !l.auto),
    streak: streaks(db, user.id, today).current,
    challenges: activeFor(db, user, today).map(({ ch, m }) => {
      const p = progressOf(db, ch, m, today);
      const info = TYPES[ch.type];
      return {
        id: ch.id, name: ch.name, type: ch.type, numeric: info.numeric, unitMany: info.many,
        loggedToday: !info.numeric && p.loggedToday,
        progressText: progressText(ch, p),
      };
    }),
    workouts: WORKOUTS.map((k) => {
      const m = METRICS[k.metric];
      return { key: k.key, label: k.label, emoji: k.emoji, activity: k.activity, unit: m.many, ask: m.ask, whole: m.whole, max: m.max };
    }),
  };
}

export function logCheckin(db: DB, user: User, today: string, body: any): CheckinResult {
  const activity = body?.activity as Activity;
  if (!ACTIVITIES.some((a) => a.key === activity)) throw new HttpError(400, 'Pick what you did.');
  const checkinId = newId();
  const createdAt = nowIso();
  const previous: Record<string, number> = {};
  const touched: { ch: Challenge; m: Member }[] = [];
  const entries: any[] = Array.isArray(body.entries) ? body.entries : [];
  const detail = cleanDetail(body?.details);
  const kind = workoutKind(detail?.workout);
  // What the workout itself measured, for a challenge that counts the same thing and was sent no number.
  const measured: Record<string, number | null | undefined> = {
    miles: kind?.metric === 'mi' ? detail?.amount : null,
    minutes: detail?.minutes,
  };
  for (const entry of entries) {
    const ch = db.challenges.find((c) => c.id === entry?.challengeId);
    const m = ch && memberOf(db, ch, user.id);
    if (!ch || !isActive(ch, m, today) || touched.some((t) => t.ch.id === ch.id)) continue;
    const numeric = TYPES[ch.type].numeric;
    const before = progressOf(db, ch, m, today);
    if (!numeric && before.loggedToday) continue; // one log a day for session challenges
    const amount = numeric ? Number(entry.amount) || Number(measured[ch.type]) : 1;
    if (!(amount > 0 && amount <= 100000)) continue;
    previous[ch.id] = Math.min(1, before.current / before.target);
    db.logs.push({ id: newId(), checkinId, userId: user.id, challengeId: ch.id, date: today, activity, type: ch.type, amount, createdAt });
    touched.push({ ch, m });
  }
  if (!touched.length) {
    if (entries.length) throw new HttpError(409, 'Already logged today.');
    db.logs.push({ id: newId(), checkinId, userId: user.id, challengeId: null, date: today, activity, type: null, amount: 1, createdAt });
  }
  if (detail) db.workouts.push({ id: checkinId, userId: user.id, ...detail });
  const cards = touched.map(({ ch, m }) => cardFor(db, ch, m, today));
  const streak = streaks(db, user.id, today).current;
  const line = cards.length
    ? `Logged. ${cards[0].progressText}.`
    : `Logged. ${streak === 1 ? 'Day one of your streak.' : `That's a ${streak} day streak.`}`;
  return { cards, previous, line, checkinId };
}

/**
 * Takes back a log made moments ago. Only today's, only your own, and by check-in id so one tap
 * removes everything that check-in counted toward. Logging is on the honor system, so there is
 * nothing to protect here beyond not touching anyone else's data or past days.
 */
export function undoCheckin(db: DB, user: User, today: string, body: any): { removed: number } {
  const id = String(body?.checkinId ?? '');
  const before = db.logs.length;
  db.logs = db.logs.filter((l) => !(l.checkinId === id && l.userId === user.id && l.date === today));
  const removed = before - db.logs.length;
  if (!removed) throw new HttpError(404, 'That log is already gone.');
  db.workouts = db.workouts.filter((w) => !(w.id === id && w.userId === user.id));
  return { removed };
}

function consequenceView(db: DB, ch: Challenge, ids: string[], viewerId?: string): ConsequenceView {
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c?.text) return { status: 'none', text: null, proposedBy: null, youProposed: false, youAgreed: false, waitingOn: 0 };
  const agreed = ids.filter((id) => c.agreedBy.includes(id)).length;
  return {
    status: ids.length >= 2 && agreed === ids.length ? 'agreed' : 'proposed',
    text: c.text,
    proposedBy: userById(db, c.proposedBy)?.name ?? null,
    youProposed: c.proposedBy === viewerId,
    youAgreed: !!viewerId && c.agreedBy.includes(viewerId),
    waitingOn: ids.length - agreed,
  };
}

function syncConsequence(db: DB, ch: Challenge): void {
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (c) c.status = consequenceView(db, ch, roster(db, ch).map((m) => m.userId)).status;
}

export function detailFor(db: DB, ch: Challenge, viewer: User | null, today: string): ChallengeDetail {
  const mine = viewer ? memberOf(db, ch, viewer.id) : undefined;
  const active = isActive(ch, mine, today);
  const status = statusOf(db, ch);
  const w = mine ? windowOf(ch, mine) : ch.houseChallenge ? { start: today, end: addDays(today, ch.lengthDays) } : { start: ch.startAt, end: ch.endAt };
  const finished = status === 'done' || (!!mine && !active);

  const fair = fairPlay(ch.type, ch.houseChallenge);
  const rows = people(db, ch, today, viewer?.id)
    .map((m) => ({ m, p: progressOf(db, ch, m, today), u: userById(db, m.userId) }))
    .filter((r): r is { m: Member; p: Progress; u: User } => !!r.u)
    .sort((a, b) =>
      share(b.p) - share(a.p) ||
      (a.p.finishedAt ?? '~').localeCompare(b.p.finishedAt ?? '~') ||
      a.u.name.localeCompare(b.u.name));

  const daysIn = diffDays(today, w.start);
  const rank = ranksOf(rows.map((r) => ({ id: r.u.id, share: share(r.p) })));
  // Movement only means something once there is a week of challenge behind it.
  const lastWeek = daysIn >= 7
    ? ranksOf(rows.map((r) => ({ id: r.u.id, share: share(progressOf(db, ch, r.m, today, addDays(today, -7))) })))
    : null;

  const open = rows.filter((r) => !r.p.complete);
  const lowest = open.length ? Math.min(...open.map((r) => share(r.p))) : null;
  const allTied = rows.every((r) => share(r.p) === share(rows[0].p));
  // Nobody is last place on day one. The challenge has to have been running a few days and
  // somebody has to have actually done something before the app starts pointing at anyone.
  const settledIn = rows.length >= 2 && daysIn >= Math.min(3, Math.ceil(ch.lengthDays / 4));
  const hookShown = !ch.houseChallenge && settledIn && lowest !== null && !allTied && rows.some((r) => r.p.credit > 0);

  const mineRow = rows.find((r) => r.u.id === viewer?.id);
  const wonRows = roster(db, ch).filter((m) => m.result === 'won');
  const winnerNames = wonRows.map((m) => userById(db, m.userId)?.name).filter((n): n is string => !!n);
  const youWon = mine?.result === 'won';
  const winnerName = youWon ? 'You' : winnerNames[0] ?? null;
  const resultText = !finished || !mine?.result
    ? null
    : mine.result === 'dropped'
      ? 'You were dropped from this one.'
      : youWon
        ? 'You won.'
        : winnerName
          ? `${winnerName} won this one.`
          : mineRow?.p.complete
            ? 'You finished it.'
            : 'Finished.';

  const alerts = db.removals
    .filter((r) => r.challengeId === ch.id && !r.resolved)
    .map((r) => {
      const m = memberOf(db, ch, r.userId);
      const since = m ? diffDays(today, progressOf(db, ch, m, today).lastLog ?? m.joinedDate) : 0;
      if (r.userId === viewer?.id) {
        return since >= 2 ? `You haven't logged in ${since} days. Log by tomorrow to stay in.` : 'Log by tomorrow to stay in this challenge.';
      }
      const name = userById(db, r.userId)?.name ?? 'Someone';
      const lead = since >= 2 ? `${name} hasn't logged in ${since} days.` : since === 1 ? `${name} hasn't logged since yesterday.` : `${name} is up for removal.`;
      return `${lead} Removing tomorrow unless they log.`;
    });

  const commissioner = active && !ch.houseChallenge && ch.creatorId === viewer?.id;
  const standings = rows.map((r) => {
    const now = rank.get(r.u.id) ?? 1;
    const moved = lastWeek ? (lastWeek.get(r.u.id) ?? now) - now : 0;
    return {
      ...person(r.u),
      rank: now,
      fraction: share(r.p),
      percent: Math.round(share(r.p) * 100),
      label: `${fmt(r.p.credit)} of ${fmt(r.p.total)}`,
      goalText: fair ? targetShort({ ...ch, target: r.p.target }) : null,
      delta: moved > 0 ? `+${moved}` : moved < 0 ? String(moved) : null,
      isYou: r.u.id === viewer?.id,
      onTheHook: hookShown && !r.p.complete && share(r.p) === lowest,
      complete: r.p.complete,
      fact: finished ? null : factFor(db, ch, r.m, today, r.u.id === viewer?.id),
    };
  });
  const consequence = ch.houseChallenge ? null : consequenceView(db, ch, rows.map((r) => r.u.id), viewer?.id);
  return {
    id: ch.id,
    name: ch.name,
    targetText: targetText(ch),
    type: ch.type,
    target: ch.target,
    per: ch.per,
    lengthDays: ch.lengthDays,
    numeric: TYPES[ch.type].numeric,
    house: ch.houseChallenge,
    status,
    daysLeftText: finished ? 'Finished' : daysLeftText(diffDays(w.end, today)),
    timeFraction: finished ? 1 : Math.min(1, Math.max(0, diffDays(today, w.start) / ch.lengthDays)),
    rangeText: rangeText(w.start, w.end),
    consequence,
    stakes: stakesFor(ch),
    rename: renameView(db, ch, consequence, standings.filter((s) => s.onTheHook).map((s) => s.id), youWon, viewer?.id),
    hero: {
      rank: mineRow ? `#${rank.get(mineRow.u.id)}` : '—',
      progress: mineRow ? `${Math.round(share(mineRow.p) * 100)}%` : '—',
      people: String(rows.length),
    },
    fair,
    yourGoalText: fair && mineRow ? targetShort({ ...ch, target: mineRow.p.target }) : null,
    winnerName,
    resultText,
    standings,
    members: rows.map((r) => person(r.u)),
    alerts,
    you: {
      member: active, commissioner, readOnly: !active, result: mine?.result ?? null,
      loggedToday: !!mine && active && !TYPES[ch.type].numeric && progressOf(db, ch, mine, today).loggedToday,
      medal: mine ? medalFor(db, ch, mine, today) : null,
    },
    addable: mine && active && ch.status !== 'done' && !ch.houseChallenge
      ? db.crew
        .filter((c) => c.userId === viewer!.id && !rows.some((r) => r.u.id === c.friendUserId))
        .map((c) => userById(db, c.friendUserId))
        .filter((u): u is User => !!u)
        .map(person)
      : [],
    talk: talkFor(db, ch, viewer?.id, today),
    timeline: mine && active && !finished ? timelineFor(db, ch, mine, today) : null,
    shared: !!ch.shared,
    manage: commissioner
      ? rows
        .filter((r) => r.u.id !== viewer?.id)
        .map((r) => ({ ...person(r.u), pending: db.removals.some((x) => x.challengeId === ch.id && x.userId === r.u.id && !x.resolved) }))
      : [],
  };
}

/**
 * The last name punishment. It exists only once the challenge is over and the crew agreed to a
 * consequence about last names; the people it lands on are the ones the standings put on the hook.
 * Each is renamed once per challenge, so a name that has run its course stays served.
 */
function renameView(db: DB, ch: Challenge, cv: ConsequenceView | null, loserIds: string[], youWon: boolean, viewerId?: string): RenameView | null {
  if (ch.status !== 'done' || !cv || cv.status !== 'agreed' || !isRenameConsequence(cv.text) || !loserIds.length) return null;
  const active = activeRenames(db);
  const targets = loserIds.flatMap((id) => {
    const u = userById(db, id);
    if (!u) return [];
    const given = db.renames.filter((r) => r.challengeId === ch.id && r.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const live = given && active.get(id)?.id === given.id ? given : null;
    return [{
      id,
      name: u.realName ?? u.name,
      isYou: id === viewerId,
      status: live ? ('active' as const) : given ? ('over' as const) : ('pending' as const),
      newName: live ? u.name : null,
      setBy: given ? (userById(db, given.byUserId)?.realName ?? userById(db, given.byUserId)?.name ?? null) : null,
      until: live ? live.expiresAt : null,
    }];
  });
  return { canSet: youWon && targets.some((t) => t.status === 'pending'), targets };
}

export function renameLoser(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  const view = detailFor(db, ch, user, today).rename;
  if (!view) throw new HttpError(400, 'This challenge has no last name to change.');
  if (memberOf(db, ch, user.id)?.result !== 'won') throw new HttpError(403, 'Only the winner picks the new last name.');
  const target = view.targets.find((t) => t.id === body?.userId);
  if (!target) throw new HttpError(400, "That person isn't on the hook.");
  if (target.status !== 'pending') throw new HttpError(400, 'That last name is already picked.');
  const lastName = cleanLastName(body?.lastName);
  if (!lastName) throw new HttpError(400, 'Use up to 20 letters. No numbers or symbols.');
  const now = Date.now();
  db.renames.push({
    id: newId(),
    challengeId: ch.id,
    userId: target.id,
    byUserId: user.id,
    lastName,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RENAME_DAYS * 86400000).toISOString(),
    revertedAt: null,
  });
  applyRenames(db);
}

/** The person it landed on can always take their own name back. */
export function resetName(db: DB, user: User): Me {
  const active = activeRenames(db).get(user.id);
  if (!active) throw new HttpError(400, "Your name hasn't been changed.");
  active.revertedAt = nowIso();
  applyRenames(db);
  return meView(user);
}

export function canView(db: DB, ch: Challenge, user: User, today: string): boolean {
  return db.members.some((m) => m.challengeId === ch.id && m.userId === user.id) || reachable(db, ch, user, today);
}

export function houseFor(db: DB, user: User, today: string): HouseCard[] {
  return db.challenges
    .filter((ch) => ch.houseChallenge)
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      stakes: stakesFor(ch),
      targetText: targetText(ch),
      memberCount: roster(db, ch).filter((m) => isActive(ch, m, today)).length,
      joined: isActive(ch, memberOf(db, ch, user.id), today),
    }));
}

// ---------- writes ----------

export function join(db: DB, ch: Challenge, user: User, today: string): void {
  if (isActive(ch, memberOf(db, ch, user.id), today)) return;
  if (ch.status === 'done') throw new HttpError(409, 'This challenge has ended.');
  db.members.push({ challengeId: ch.id, userId: user.id, joinedAt: nowIso(), joinedDate: today, removedAt: null, result: null });
  // The invite shows the consequence before anyone joins, so joining counts as agreeing to it.
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (c?.text && !c.agreedBy.includes(user.id)) c.agreedBy.push(user.id);
  if (!ch.houseChallenge && roster(db, ch).length >= 2) ch.status = 'live';
  syncConsequence(db, ch);
}

/**
 * Puts people from your crew straight into a challenge you are in. They are in from today, exactly as
 * if they had tapped an invite, with one difference: nobody agreed to a consequence on their behalf.
 */
export function addCrew(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireMember(db, ch, user, today);
  if (ch.houseChallenge) throw new HttpError(403, 'Anyone can join this one themselves.');
  if (ch.status === 'done') throw new HttpError(409, 'This challenge has ended.');
  const ids: string[] = (Array.isArray(body?.userIds) ? body.userIds : []).map(String).slice(0, 50);
  let added = 0;
  for (const id of new Set(ids)) {
    const friend = userById(db, id);
    if (!friend || !db.crew.some((c) => c.userId === user.id && c.friendUserId === id)) continue;
    if (isActive(ch, memberOf(db, ch, id), today)) continue;
    db.members.push({ challengeId: ch.id, userId: id, joinedAt: nowIso(), joinedDate: today, removedAt: null, result: null, addedBy: user.id });
    added++;
  }
  if (!added) throw new HttpError(400, 'Pick someone from your crew.');
  if (roster(db, ch).length >= 2) ch.status = 'live';
  syncConsequence(db, ch);
}

export function inviteFor(db: DB, user: User, challengeId: string | null): string {
  const existing = db.invites.find((i) => i.invitedBy === user.id && i.challengeId === challengeId);
  if (existing) return existing.token;
  let token = '';
  do token = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  while (db.invites.some((i) => i.token === token));
  db.invites.push({ token, challengeId, invitedBy: user.id, acceptedBy: [], createdAt: nowIso() });
  return token;
}

export function inviteByToken(db: DB, token: string): Invite {
  // Links carry the token exactly. Someone typing a code from a text may add a dash or use lowercase.
  const typed = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const invite = db.invites.find((i) => i.token === token) ?? db.invites.find((i) => i.token === typed);
  if (!invite) throw new HttpError(404, 'This invite link does not work anymore.');
  return invite;
}

export function invitePreview(db: DB, invite: Invite, viewer: User | null, today: string): InvitePreview {
  const ch = invite.challengeId ? challengeById(db, invite.challengeId) : null;
  return {
    token: invite.token,
    inviterName: userById(db, invite.invitedBy)?.name ?? 'A friend',
    challenge: ch ? detailFor(db, ch, viewer, today) : null,
    alreadyMember: !!ch && !!viewer && isActive(ch, memberOf(db, ch, viewer.id), today),
    ended: ch?.status === 'done',
  };
}

export function acceptInvite(db: DB, invite: Invite, user: User, today: string): string | null {
  if (invite.invitedBy !== user.id) {
    for (const [a, b] of [[invite.invitedBy, user.id], [user.id, invite.invitedBy]]) {
      if (!db.crew.some((c) => c.userId === a && c.friendUserId === b)) db.crew.push({ userId: a, friendUserId: b });
    }
  }
  if (!invite.acceptedBy.includes(user.id)) invite.acceptedBy.push(user.id);
  if (invite.challengeId) join(db, challengeById(db, invite.challengeId), user, today);
  return invite.challengeId;
}

export function signup(db: DB, today: string, body: any): SignupResult {
  const name = cleanText(body?.name, 30);
  if (!name) throw new HttpError(400, 'Tell us what to call you.');
  const invite = body?.inviteToken ? inviteByToken(db, String(body.inviteToken)) : null;
  const inviteType = invite?.challengeId ? challengeById(db, invite.challengeId).type : null;
  const tracked = validTracked(body?.trackedTypes) ?? (inviteType && inviteType !== 'custom' ? [inviteType] : []);
  const user: User = {
    id: newId(),
    name,
    avatar: db.users.length % 6,
    workoutTime: TIMES.includes(body?.workoutTime) ? body.workoutTime : '07:00',
    trackedTypes: tracked,
    band: isBand(body?.band) ? body.band : 'active',
    notifications: true,
    token: newId(24),
    createdAt: nowIso(),
    phone: null,
    pinSalt: null,
    pinHash: null,
  };
  db.users.push(user);
  applyPhonePin(db, user, body);
  const challengeId = invite ? acceptInvite(db, invite, user, today) : null;
  return { token: user.token, user: meView(user), challengeId };
}

function validTracked(v: unknown): TrackType[] | null {
  if (!Array.isArray(v)) return null;
  const picked = TRACK_TYPES.filter((t) => v.includes(t));
  return picked.length >= 1 && picked.length <= 3 ? picked : null;
}

/** The portable credential — how someone signs back in on a device that doesn't already
 * remember them. Both fields are optional and can be set at signup or later from settings. */
function applyPhonePin(db: DB, user: User, body: any): void {
  if (body?.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
      user.phone = null;
      user.pinSalt = null;
      user.pinHash = null;
    } else {
      if (phone.length !== 10) throw new HttpError(400, 'Enter a 10 digit phone number.');
      if (db.users.some((u) => u.id !== user.id && u.phone === phone)) {
        throw new HttpError(409, 'That phone number already has an account. Try signing in instead.');
      }
      user.phone = phone;
    }
  }
  if (body?.pin !== undefined) {
    if (!isPin(body.pin)) throw new HttpError(400, 'Enter a 4 digit PIN.');
    if (!user.phone) throw new HttpError(400, 'Add a phone number first.');
    const { salt, hash } = hashPin(body.pin);
    user.pinSalt = salt;
    user.pinHash = hash;
  }
}

export function updateMe(db: DB, user: User, body: any): Me {
  if (body?.name !== undefined) {
    const name = cleanText(body.name, 30);
    if (!name) throw new HttpError(400, 'Your name cannot be empty.');
    if (name !== user.name) {
      if (user.nameChange) throw new HttpError(403, `${user.nameChange.by} picked your last name. You can change your name when it ends, or change it back first.`);
      user.name = name;
    }
  }
  if (TIMES.includes(body?.workoutTime)) user.workoutTime = body.workoutTime;
  if (body?.trackedTypes !== undefined) {
    const tracked = validTracked(body.trackedTypes);
    if (!tracked) throw new HttpError(400, 'Pick up to three things to track.');
    user.trackedTypes = tracked;
  }
  if (typeof body?.notifications === 'boolean') user.notifications = body.notifications;
  if (body?.band !== undefined) {
    if (!isBand(body.band)) throw new HttpError(400, 'Pick how active you are.');
    user.band = body.band;
  }
  applyPhonePin(db, user, body);
  return meView(user);
}

/** Signing in on a device that doesn't already remember you — the phone and PIN you set up
 * are the only portable credential this app has. */
export function signin(db: DB, body: any): SignupResult {
  const phone = normalizePhone(body?.phone);
  if (phone.length !== 10) throw new HttpError(400, 'Enter your 10 digit phone number.');
  if (!isPin(body?.pin)) throw new HttpError(400, 'Enter your 4 digit PIN.');
  const user = db.users.find((u) => u.phone === phone);
  const ok = !!user?.pinHash && !!user.pinSalt && verifyPin(body.pin, user.pinSalt, user.pinHash);
  if (!user || !ok) throw new HttpError(401, "That phone number and PIN don't match.");
  return { token: user.token, user: meView(user), challengeId: null };
}

export function createChallenge(db: DB, user: User, today: string, body: any): { id: string; token: string } {
  const type = body?.type;
  if (!(type in TYPES)) throw new HttpError(400, 'Pick a kind of challenge.');
  const per = body.per === 'day' ? 'day' : 'week';
  const lengthDays = Number(body.lengthDays);
  if (![7, 14, 28].includes(lengthDays)) throw new HttpError(400, 'Pick a length.');
  const target = Number(body.target);
  if (!targetOptions(type, per).includes(target)) throw new HttpError(400, 'Pick a target.');
  const customName = cleanText(body.name, 40);
  if (type === 'custom' && !customName) throw new HttpError(400, 'Name your challenge.');
  const consequence = cleanText(body.consequence, 80);
  const problem = consequence && offLimitsReason(consequence);
  if (problem) throw new HttpError(400, problem);

  const ch: Challenge = {
    id: newId(), creatorId: user.id, name: customName || TYPES[type as keyof typeof TYPES].defaultName,
    type, target, per, lengthDays, startAt: today, endAt: addDays(today, lengthDays),
    status: 'waiting', houseChallenge: false, createdAt: nowIso(), shared: body.shared === true,
  };
  db.challenges.push(ch);
  db.members.push({ challengeId: ch.id, userId: user.id, joinedAt: nowIso(), joinedDate: today, removedAt: null, result: null });
  db.consequences.push({
    challengeId: ch.id,
    text: consequence || null,
    proposedBy: consequence ? user.id : null,
    agreedBy: consequence ? [user.id] : [],
    status: consequence ? 'proposed' : 'none',
  });
  return { id: ch.id, token: inviteFor(db, user, ch.id) };
}

function requireMember(db: DB, ch: Challenge, user: User, today: string): Member {
  const m = memberOf(db, ch, user.id);
  if (!isActive(ch, m, today)) throw new HttpError(403, "You're not in this challenge.");
  return m;
}

function requireCommissioner(db: DB, ch: Challenge, user: User, today: string): void {
  requireMember(db, ch, user, today);
  if (ch.houseChallenge || ch.creatorId !== user.id) throw new HttpError(403, 'Only the person who started this can do that.');
}

export function proposeConsequence(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireMember(db, ch, user, today);
  if (ch.houseChallenge) throw new HttpError(400, 'House challenges have no consequence.');
  const text = cleanText(body?.text, 80);
  if (!text) throw new HttpError(400, 'Pick or write a consequence.');
  const problem = offLimitsReason(text);
  if (problem) throw new HttpError(400, problem);
  let c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c) db.consequences.push((c = { challengeId: ch.id, text: null, proposedBy: null, agreedBy: [], status: 'none' }));
  c.text = text;
  c.proposedBy = user.id;
  c.agreedBy = [user.id];
  syncConsequence(db, ch);
}

export function agreeConsequence(db: DB, ch: Challenge, user: User, today: string): void {
  requireMember(db, ch, user, today);
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c?.text) throw new HttpError(400, 'Nothing to agree to yet.');
  if (!c.agreedBy.includes(user.id)) c.agreedBy.push(user.id);
  syncConsequence(db, ch);
}

export function requestRemoval(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireCommissioner(db, ch, user, today);
  const targetId = String(body?.userId ?? '');
  if (targetId === user.id || !isActive(ch, memberOf(db, ch, targetId), today)) throw new HttpError(400, "They're not in this challenge.");
  if (db.removals.some((r) => r.challengeId === ch.id && r.userId === targetId && !r.resolved)) return;
  db.removals.push({ id: newId(), challengeId: ch.id, userId: targetId, requestedBy: user.id, requestedAt: nowIso(), resolved: null });
}

/**
 * Removes a challenge outright: for one made by mistake. Only the person who started it can. The
 * workouts people logged stay theirs (streaks and weekly totals do not move); they just stop pointing
 * at a challenge that is gone. A last name handed out by this challenge goes back.
 */
export function deleteChallenge(db: DB, ch: Challenge, user: User): void {
  if (ch.houseChallenge || ch.creatorId !== user.id) throw new HttpError(403, 'Only the person who started this can do that.');
  const gone = (x: { challengeId: string | null }) => x.challengeId === ch.id;
  db.challenges = db.challenges.filter((c) => c.id !== ch.id);
  db.members = db.members.filter((x) => !gone(x));
  db.consequences = db.consequences.filter((x) => !gone(x));
  db.invites = db.invites.filter((x) => !gone(x));
  db.removals = db.removals.filter((x) => !gone(x));
  db.renames = db.renames.filter((x) => !gone(x));
  db.flairs = db.flairs.filter((x) => !gone(x));
  db.messages = db.messages.filter((x) => !gone(x));
  // A person's own logs stay as plain workouts; step counts written by syncing only existed for the challenge.
  db.logs = db.logs.filter((l) => !(gone(l) && l.auto));
  for (const log of db.logs) if (gone(log)) log.challengeId = null;
}

export function endEarly(db: DB, ch: Challenge, user: User, today: string): void {
  requireCommissioner(db, ch, user, today);
  ch.endAt = addDays(today, 1);
  finish(db, ch, today);
  applyFlairs(db, today); // so the answer to this very request already shows who is wearing what
}
