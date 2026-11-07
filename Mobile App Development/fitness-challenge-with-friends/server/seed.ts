// Dev only. Gives a real signup a crew, a few challenges and some history, so every screen has
// something to show during a walkthrough. Sign up in the app first, then:
//   npm run seed              (uses the most recent signup)
//   node server/seed.ts Dana  (uses the signup with that name)
import { RENAME_CONSEQUENCE } from '../shared/copy.ts';
import { addDays, localDate } from '../shared/catalog.ts';
import type { Activity, Band, ChallengeType, Per } from '../shared/catalog.ts';
import { settle } from './logic.ts';
import { load, newId, save } from './store.ts';
import type { Challenge, User } from './store.ts';

const db = load();
const today = localDate();
const wanted = process.argv[2]?.toLowerCase();
const found = wanted
  ? db.users.find((u) => u.name.toLowerCase() === wanted)
  : [...db.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

if (!found) {
  console.error('No signup found. Sign up in the app first, then run this again.');
  process.exit(1);
}
const me: User = found;
const crewNames = db.crew.filter((c) => c.userId === me.id).map((c) => db.users.find((u) => u.id === c.friendUserId)?.name);
if (crewNames.includes('Maria')) {
  console.error(`${me.name} already has the demo crew.`);
  process.exit(1);
}

const at = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function friend(name: string, avatar: number, band: Band): User {
  const u: User = {
    id: newId(), name, avatar, workoutTime: '18:00', trackedTypes: ['walk', 'gym'], notifications: true,
    band, token: newId(24), createdAt: at(addDays(today, -60), 9),
    phone: null, pinSalt: null, pinHash: null,
  };
  db.users.push(u);
  db.crew.push({ userId: me.id, friendUserId: u.id }, { userId: u.id, friendUserId: me.id });
  return u;
}

function challenge(s: {
  name: string; type: ChallengeType; target: number; per: Per; lengthDays: number; startDaysAgo: number;
  creator: User; members: User[]; consequence?: string; proposer?: User; agreed?: User[];
}): Challenge {
  const startAt = addDays(today, -s.startDaysAgo);
  const ch: Challenge = {
    id: newId(), creatorId: s.creator.id, name: s.name, type: s.type, target: s.target, per: s.per,
    lengthDays: s.lengthDays, startAt, endAt: addDays(startAt, s.lengthDays), status: 'live',
    houseChallenge: false, createdAt: at(startAt, 8),
  };
  db.challenges.push(ch);
  for (const u of s.members) {
    db.members.push({ challengeId: ch.id, userId: u.id, joinedAt: at(startAt, 9), joinedDate: startAt, removedAt: null, result: null });
  }
  const agreed = (s.agreed ?? []).map((u) => u.id);
  db.consequences.push({
    challengeId: ch.id,
    text: s.consequence ?? null,
    proposedBy: s.consequence ? (s.proposer ?? s.creator).id : null,
    agreedBy: agreed,
    status: !s.consequence ? 'none' : agreed.length === s.members.length ? 'agreed' : 'proposed',
  });
  return ch;
}

function log(u: User, ch: Challenge | null, daysAgo: number, activity: Activity, amount = 1) {
  const date = addDays(today, -daysAgo);
  db.logs.push({
    id: newId(), checkinId: newId(), userId: u.id, challengeId: ch?.id ?? null, date, activity,
    type: ch?.type ?? null, amount, createdAt: at(date, 12 + Math.floor(Math.random() * 6)),
  });
}

const maria = friend('Maria', 1, 'very');
const keisha = friend('Keisha', 2, 'active');
const tom = friend('Tom', 3, 'starting');

const pilates = challenge({
  name: 'Pilates push', type: 'class', target: 2, per: 'week', lengthDays: 28, startDaysAgo: 9,
  creator: maria, members: [maria, me, keisha, tom], consequence: 'Buys coffee', agreed: [maria, me, keisha, tom],
});
[8, 5, 2, 0].forEach((d) => log(maria, pilates, d, 'class'));
[7, 4, 1].forEach((d) => log(me, pilates, d, 'class'));
[6, 0].forEach((d) => log(keisha, pilates, d, 'class'));
log(tom, pilates, 5, 'class');

const steps = challenge({
  name: 'Steps showdown', type: 'steps', target: 8000, per: 'day', lengthDays: 14, startDaysAgo: 3,
  creator: me, members: [me, keisha], consequence: 'Sings at the next hangout', proposer: keisha, agreed: [keisha],
});
[[3, 9000], [2, 7500], [1, 8200]].forEach(([d, n]) => log(me, steps, d, 'walk', n));
[[3, 8000], [2, 10000], [1, 6000], [0, 4500]].forEach(([d, n]) => log(keisha, steps, d, 'walk', n));

const walks = challenge({
  name: 'Walk it off', type: 'walk', target: 1, per: 'day', lengthDays: 7, startDaysAgo: 20,
  creator: tom, members: [tom, me, maria], consequence: RENAME_CONSEQUENCE, agreed: [tom, me, maria],
});
[20, 19, 18, 17, 16, 15, 14].forEach((d) => log(me, walks, d, 'walk'));
[20, 18, 17, 15, 14].forEach((d) => log(tom, walks, d, 'walk'));
[19, 18, 17, 16, 14].forEach((d) => log(maria, walks, d, 'walk'));

for (const [house, users] of [['house-walk7', [maria, keisha]], ['house-10k', [tom]]] as const) {
  for (const u of users) {
    db.members.push({ challengeId: house, userId: u.id, joinedAt: at(addDays(today, -2), 9), joinedDate: addDays(today, -2), removedAt: null, result: null });
  }
}

settle(db, today);
save(db);
console.log(`Seeded a crew and three challenges for ${me.name}. Pull to refresh or switch tabs in the app.`);
